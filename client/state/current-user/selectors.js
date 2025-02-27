/**
 * Returns the current user ID
 *
 * @param  {object}  state  Global state tree
 * @returns {?number}        Current user ID
 */
export function getCurrentUserId( state ) {
	return state.currentUser?.id;
}

/**
 * Is the current user logged in?
 *
 * @param {object} state Global state tree
 * @returns {boolean}	True if logged in, False if not
 */
export function isUserLoggedIn( state ) {
	return getCurrentUserId( state ) !== null;
}

/**
 * Returns the user object for the current user.
 *
 * @param  {object}  state  Global state tree
 * @returns {import('calypso/lib/user/user').UserData|null}        Current user
 */
export function getCurrentUser( state ) {
	return state?.currentUser?.user ?? null;
}

/**
 * Returns a selector that fetches a property from the current user object
 *
 * @template S,T
 * @param {string} path Path to the property in the user object
 * @param {?T} otherwise A default value that is returned if no user or property is found
 * @returns {(state: S) => T} A selector which takes the state as a parameter
 */
export const createCurrentUserSelector =
	( path, otherwise = null ) =>
	( state ) => {
		const user = getCurrentUser( state );
		return user?.[ path ] ?? otherwise;
	};

/**
 * Returns the locale slug for the current user.
 *
 * @param  {object}  state  Global state tree
 * @returns {?string}        Current user locale
 */
export const getCurrentUserLocale = createCurrentUserSelector( 'localeSlug' );

/**
 * Returns the country code for the current user.
 *
 * @param  {object}  state  Global state tree
 * @returns {?string}        Current user country code
 */
export const getCurrentUserCountryCode = createCurrentUserSelector( 'user_ip_country_code' );

/**
 * Returns the number of sites for the current user.
 *
 * @param  {object}  state  Global state tree
 * @returns {?number}        Current user site count
 */
export function getCurrentUserSiteCount( state ) {
	const user = getCurrentUser( state );
	if ( ! user ) {
		return null;
	}

	return user.site_count || 0;
}

/**
 * Returns the number of visible sites for the current user.
 *
 * @param  {object}  state  Global state tree
 * @returns {?number}        Current user visible site count
 */
export function getCurrentUserVisibleSiteCount( state ) {
	const user = getCurrentUser( state );
	if ( ! user ) {
		return null;
	}

	return user.visible_site_count || 0;
}

/**
 * Returns the date (of registration) for the current user.
 *
 * @param  {object}  state  Global state tree
 * @returns {?string}        Date of registration for user
 */
export const getCurrentUserDate = createCurrentUserSelector( 'date' );

/**
 *  Returns the username of the current user.
 *
 *  @param {object} state Global state tree
 *  @returns {?string} The username of the current user.
 */
export const getCurrentUserName = createCurrentUserSelector( 'username' );

/**
 *  Returns the primary email of the current user.
 *
 *  @param {object} state Global state tree
 *  @returns {?string} The primary email of the current user.
 */
export const getCurrentUserEmail = createCurrentUserSelector( 'email' );

/**
 *  Returns the primary email of the current user.
 *
 *  @param {object} state Global state tree
 *  @returns {?string} The primary email of the current user.
 */
export const getCurrentUserDisplayName = createCurrentUserSelector( 'display_name' );

/**
 * Returns true if the specified flag is enabled for the user
 *
 * @param  {object}   state      Global state tree
 * @param {string}    flagName   Flag name
 * @returns {boolean}            Whether the flag is enabled for the user
 */
export function currentUserHasFlag( state, flagName ) {
	return state.currentUser.flags.indexOf( flagName ) !== -1;
}

/**
 * Returns true if the current user is email-verified.
 *
 * @param   {object } state Global state tree
 * @returns {boolean}       Whether the current user is email-verified.
 */
export const isCurrentUserEmailVerified = createCurrentUserSelector( 'email_verified', false );

/**
 * Returns the Lasagna JWT for the current user.
 *
 * @param  {object}  state  Global state tree
 * @returns {?string}       Lasagna JWT
 */
export function getCurrentUserLasagnaJwt( state ) {
	return state.currentUser.lasagnaJwt;
}

/**
 * Returns true if the user was bootstrapped (i.e. user data was fetched by the server
 * and hydrated using window.currentUser)
 *
 * @returns {boolean} Whether the current user is bootstrapped
 */
export const isCurrentUserBootstrapped = createCurrentUserSelector( 'bootstrapped', false );
