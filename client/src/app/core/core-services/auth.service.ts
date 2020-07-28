import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from 'environments/environment';

import { OperatorService } from 'app/core/core-services/operator.service';
import { DataStoreService } from './data-store.service';
import { HttpService } from './http.service';
import { OpenSlidesService } from './openslides.service';
import { TokenService } from './token.service';

/**
 * Response from a login request.
 */
export interface LoginResponse {
    message: string;
    success: boolean;
    token?: string;
}

/**
 * Authenticates an OpenSlides user with username and password
 */
@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private accessToken: string = null;

    /**
     * Initializes the httpClient and the {@link OperatorService}.
     *
     * @param http HttpService to send requests to the server
     * @param operator Who is using OpenSlides
     * @param OpenSlides The openslides service
     * @param router To navigate
     */
    public constructor(
        private http: HttpService,
        private tokenService: TokenService,
        private operator: OperatorService,
        private OpenSlides: OpenSlidesService,
        private router: Router,
        private DS: DataStoreService
    ) {}

    /**
     * Try to log in a user with a given auth type
     *
     * - Type "default": username and password needed; the earlySuccessCallback will be called.
     * - Type "saml": The windows location will be changed to the single-sign-on service initiator.
     */
    // TODO: remove auth type
    public async login(username: string, password: string, earlySuccessCallback: () => void): Promise<void> {
        // if (authType === 'default') {
        const user = {
            username: username,
            password: password
        };
        const response = await this.http.post<LoginResponse>(environment.authUrlPrefix + '/login/', user);
        if (response.token) {
            this.setAccessToken(response.token);
        }
        earlySuccessCallback();
        await this.OpenSlides.shutdown();
        // await this.operator.setWhoAmI(response);
        // await this.OpenSlides.afterLoginBootup();
        await this.redirectUser();

        // } else if (authType === 'saml') {
        //     window.location.href = environment.urlPrefix + '/saml/?sso'; // Bye
        // } else {
        //     throw new Error(`Unsupported auth type "${authType}"`);
        // }
    }

    /**
     * Redirects the user to the page where he came from. Boots OpenSlides,
     * if it wasn't done before.
     */
    public async redirectUser(): Promise<void> {
        if (!this.OpenSlides.isBooted) {
            this.OpenSlides.afterAuthenticatedBootup();
        }

        let redirect = this.OpenSlides.redirectUrl ? this.OpenSlides.redirectUrl : '/';

        const excludedUrls = ['login'];
        if (excludedUrls.some(url => redirect.includes(url))) {
            redirect = '/';
        }
        this.router.navigate([redirect]);
    }

    /**
     * Login for guests.
     */
    public async guestLogin(): Promise<void> {
        this.redirectUser();
    }

    /**
     * Logout function for both the client and the server.
     *
     * Will clear the datastore, update the current operator and
     * send a `post`-request to `/apps/users/logout/'`. Restarts OpenSlides.
     */
    public async logout(): Promise<void> {
        const response = await this.http.post<LoginResponse>(environment.authUrlPrefix + '/api/logout/');
        if (response.success) {
            this.setAccessToken('');
        }
        this.router.navigate(['/']);
        await this.OpenSlides.reboot();
        /*const authType = this.operator.authType.getValue();
        if (authType === DEFAULT_AUTH_TYPE) {
            let response = null;
            try {
                response = await this.http.post<WhoAmI>(environment.urlPrefix + '/users/logout/', {});
            } catch (e) {
                // We do nothing on failures. Reboot OpenSlides anyway.
            }
            this.router.navigate(['/']);
            await this.DS.clear();
            await this.operator.setWhoAmI(response);
            await this.OpenSlides.reboot();
        } else if (authType === 'saml') {
            await this.DS.clear();
            await this.operator.setWhoAmI(null);
            window.location.href = environment.urlPrefix + '/saml/?slo'; // Bye
        } else {
            throw new Error(`Unsupported auth type "${authType}"`);
        }*/
        // throw new Error('TODO'); // just ignore the SAML case for now..
    }

    public isAuthenticated(): boolean {
        return !!this.accessToken;
    }

    private setAccessToken(token: string): void {
        this.accessToken = token;
        this.tokenService.nextAccessToken(token);
    }
}
