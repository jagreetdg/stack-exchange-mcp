// src/auth/auth-service.ts
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as StackExchangeStrategy } from 'passport-stackexchange';
import { Logger } from '../utils/logger.js';
export class AuthService {
    static instance;
    app;
    logger;
    authState = {};
    authPromise = null;
    resolveAuth = null;
    config;
    constructor(config) {
        this.logger = new Logger('AuthService');
        this.config = config;
        this.setupExpressApp();
    }
    static getInstance(config) {
        if (!AuthService.instance) {
            if (!config) {
                throw new Error('AuthService must be initialized with config first');
            }
            AuthService.instance = new AuthService(config);
        }
        return AuthService.instance;
    }
    setupExpressApp() {
        this.app = express();
        // Session middleware
        this.app.use(session({
            secret: 'stack-exchange-mcp-secret',
            resave: false,
            saveUninitialized: false
        }));
        // Passport setup
        this.app.use(passport.initialize());
        this.app.use(passport.session());
        passport.use(new StackExchangeStrategy({
            clientID: this.config.clientId,
            clientSecret: '', // Not needed for implicit flow
            callbackURL: this.config.redirectUri,
            key: this.config.apiKey, // This is the Stack Exchange API key
            site: 'stackoverflow'
        }, (accessToken, refreshToken, profile, done) => {
            // Store the access token
            this.authState.accessToken = accessToken;
            // Set expiry to 24 hours from now if not provided
            this.authState.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
            if (this.resolveAuth) {
                this.resolveAuth();
            }
            done(null, { id: profile.id, displayName: profile.displayName });
        }));
        passport.serializeUser((user, done) => done(null, user));
        passport.deserializeUser((user, done) => done(null, user));
        // Auth routes
        this.app.get('/oauth/login', passport.authenticate('stackexchange'));
        this.app.get('/oauth/callback', passport.authenticate('stackexchange', { session: false }), (req, res) => {
            res.send('<script>window.close();</script>');
        });
    }
    async startAuthServer() {
        return new Promise((resolve, reject) => {
            const server = this.app.listen(3000, () => {
                this.logger.info('Auth server started on port 3000');
                resolve();
            });
            server.on('error', (error) => {
                this.logger.error('Failed to start auth server', error);
                reject(error);
            });
        });
    }
    async ensureAuthenticated() {
        // If we have a valid access token, return it
        if (this.authState.accessToken && this.authState.expiresAt && this.authState.expiresAt > Date.now()) {
            return this.authState;
        }
        // If authentication is already in progress, wait for it
        if (this.authPromise) {
            await this.authPromise;
            return this.authState;
        }
        // Start new authentication flow
        this.authPromise = new Promise((resolve) => {
            this.resolveAuth = resolve;
        });
        // Start the auth server if not already running
        await this.startAuthServer();
        // Open the OAuth dialog
        const authUrl = `https://stackoverflow.com/oauth/dialog?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(this.config.redirectUri)}&scope=write_access private_info`;
        this.logger.info('Opening auth URL:', authUrl);
        // In a real browser environment, we would use window.open()
        // For now, we'll just log the URL and ask the user to open it
        console.log('\nAuthentication required!');
        console.log('Please open this URL in your browser to authenticate:');
        console.log(authUrl);
        // Wait for authentication to complete
        await this.authPromise;
        this.authPromise = null;
        this.resolveAuth = null;
        return this.authState;
    }
    getAuthState() {
        return this.authState;
    }
    getConfig() {
        return this.config;
    }
}
