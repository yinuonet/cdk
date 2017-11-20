import * as fs from 'fs';
import * as yaml from 'js-yaml';

import { NoAuthenticationError, ShortCodeExpireError, UnexpectedHttpError } from './errors';
import { IOAuthTokenData, OAuthClient, OAuthTokens } from './shortcode';
import { api, exists, Fetcher, IRequester, readFile, wrapErr } from './util';

interface IHostProfile {
  tokens: IOAuthTokenData;
  userdata: IUser;
}

interface IProfile {
  hosts: { [url: string]: IHostProfile };
}

/**
 * IUser is the minimal user structure stored in the profile.
 */
export interface IUser {
  id: number;
  username: string;
  channel: number;
}

/**
 * IGrantNotifier prompts the user to enter the granting code.
 */
export interface IGrantNotifier {
  /**
   * Tells the user to enter the code on mixer.com/go
   */
  prompt(code: string): void;

  /**
   * Whether we should cancel lookup up the code.
   */
  isCancelled(): boolean;
}

/**
 * Thrown once the GrantNotifier says the the grant is cancelled,
 * in Profile.grant().
 */
export class GrantCancelledError extends Error {}

/**
 * Profile represents a user profile for miix, stored in the .miixrc file.
 */
export class Profile {
  public static necessaryScopes = [
    'interactive:manage:self',
    'interactive:play',
    'channel:teststream:view:self',
  ];

  private tokensObj: OAuthTokens | undefined;
  private profile: IProfile = {
    hosts: {},
  };

  private get hostProfile() {
    return this.profile.hosts[this.host];
  }

  constructor(
    private readonly file: string,
    private readonly oauthClient: OAuthClient = new OAuthClient({
      clientId: '9789aae60656644524be9530889ba8884c0095834ae75f50',
      scopes: Profile.necessaryScopes,
    }),
    private readonly requester: IRequester = new Fetcher(),
    private readonly host = api(),
  ) {}

  /**
   * Returns valid OAuth tokens for the session. It will prompt the user to
   * grant access if the tokens don't exist or are expired.
   */
  public async tokens(): Promise<OAuthTokens> {
    await this.ensureProfile();
    return this.tokensObj!;
  }

  /**
   * Returns data about the currently authenticated user.
   */
  public async user(): Promise<IUser> {
    await this.ensureProfile();
    return this.hostProfile.userdata;
  }

  /**
   * Returns whether the user currently has valid credentials.
   */
  public async hasAuthenticated(): Promise<boolean> {
    if (!this.hostProfile) {
      await this.tryLoadFile();
    }

    return this.tokensObj !== undefined && !this.tokensObj.expired();
  }

  /**
   * Logs out of the current session, if the user is authenticated.
   */
  public async logout(): Promise<void> {
    await this.tryLoadFile();
    delete this.profile.hosts[this.host];
    this.tokensObj = undefined;
    await this.save();
  }

  /**
   * Prompts the user to grant the tokens anew, and saves the profile.
   */
  public async grant(notifier: IGrantNotifier): Promise<OAuthTokens> {
    await this.tryLoadFile();

    let tokens: OAuthTokens | undefined;
    do {
      if (notifier.isCancelled()) {
        throw new GrantCancelledError();
      }

      const code = await this.oauthClient.getCode();
      notifier.prompt(code.code);

      try {
        tokens = await code.waitForAccept();
      } catch (e) {
        if (!(e instanceof ShortCodeExpireError)) {
          throw e;
        }
      }
    } while (!tokens);

    const udata = await this.requester
      .with(tokens)
      .json('get', '/users/current?fields=id,username,channel')
      .then(async res => res.json());

    this.tokensObj = tokens;
    this.profile.hosts[this.host] = {
      tokens: this.tokensObj.data,
      userdata: {
        id: udata.id,
        username: udata.username,
        channel: udata.channel.id,
      },
    };

    await this.save();

    return tokens;
  }

  /**
   * Ensures that the profile exists and has valid grants.
   */
  private async ensureProfile(): Promise<IHostProfile> {
    const hostProfile = this.profile && this.profile.hosts[this.host];
    if (hostProfile) {
      return hostProfile;
    }

    if (!await this.tryLoadFile()) {
      throw new NoAuthenticationError();
    } else if (!this.tokensObj!.granted(Profile.necessaryScopes)) {
      throw new NoAuthenticationError();
    } else if (this.tokensObj!.expired()) {
      try {
        await this.refresh();
      } catch (err) {
        if (err instanceof UnexpectedHttpError && err.tryJson()!.error === 'invalid_grant') {
          throw new NoAuthenticationError();
        } else {
          throw err;
        }
      }
    }

    return this.profile.hosts[this.host];
  }

  /**
   * Persists the saved tokens to disk.
   */
  private async save(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.writeFile(this.file, yaml.safeDump(this.profile), err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Refreshes the token grants and saves the profile.
   */
  private async refresh(): Promise<void> {
    if (!this.tokensObj) {
      throw new Error('Cannot refresh without an available tokensObj');
    }

    this.tokensObj = await this.oauthClient.refresh(this.tokensObj);
    this.hostProfile.tokens = this.tokensObj.data;
    await this.save();
  }

  /**
   * Attempts to load existing data from the profile file, returning whether
   * it was able to do so successfully.
   */
  private async tryLoadFile(): Promise<boolean> {
    return exists(this.file).then(ok => {
      if (!ok) {
        return false;
      }

      return readFile(this.file).then(contents => {
        try {
          this.profile = yaml.safeLoad(contents);
        } catch (err) {
          throw wrapErr(err, `Error parsing profile from ${this.file}`);
        }

        if (!this.hostProfile) {
          return false;
        }

        this.tokensObj = new OAuthTokens({
          ...this.hostProfile.tokens,
          expiresAt: new Date(this.hostProfile.tokens.expiresAt),
        });

        return true;
      });
    });
  }
}