import { translate } from 'i18n-calypso';
import { isEmpty, mapValues } from 'lodash';
import { decodeEntities } from 'calypso/lib/formatting';
import { USER_SETTINGS_REQUEST, USER_SETTINGS_SAVE } from 'calypso/state/action-types';
import { fetchCurrentUser } from 'calypso/state/current-user/actions';
import { registerHandlers } from 'calypso/state/data-layer/handler-registry';
import { http } from 'calypso/state/data-layer/wpcom-http/actions';
import { dispatchRequest } from 'calypso/state/data-layer/wpcom-http/utils';
import { errorNotice, successNotice } from 'calypso/state/notices/actions';
import getUnsavedUserSettings from 'calypso/state/selectors/get-unsaved-user-settings';
import {
	clearUnsavedUserSettings,
	fetchUserSettingsFailure,
	fetchUserSettingsSuccess,
	saveUserSettingsSuccess,
	saveUserSettingsFailure,
} from 'calypso/state/user-settings/actions';

/*
 * Decodes entities in those specific user settings properties
 * that the REST API returns already HTML-encoded
 */
const PROPERTIES_TO_DECODE = new Set( [ 'display_name', 'description', 'user_URL' ] );
export const fromApi = ( apiResponse ) =>
	mapValues( apiResponse, ( value, name ) =>
		PROPERTIES_TO_DECODE.has( name ) ? decodeEntities( value ) : value
	);

/*
 * Fetch settings from the WordPress.com API at /me/settings endpoint
 */
export const requestUserSettings = ( action ) =>
	http(
		{
			apiVersion: '1.1',
			method: 'GET',
			path: '/me/settings',
		},
		action
	);

export const requestUserSettingsFailure = ( action, error ) => fetchUserSettingsFailure( error );

export const requestUserSettingsSuccess = ( action, data ) => fetchUserSettingsSuccess( data );

/*
 * Store the fetched user settings to Redux state
 */
export const storeFetchedUserSettings = ( action, data ) => saveUserSettingsSuccess( data );

/*
 * Post settings to WordPress.com API at /me/settings endpoint
 */
export function userSettingsSave( action ) {
	return ( dispatch, getState ) => {
		const { settingsOverride } = action;
		const settings = settingsOverride || getUnsavedUserSettings( getState() );
		if ( ! isEmpty( settings ) ) {
			dispatch(
				http(
					{
						apiVersion: '1.1',
						method: 'POST',
						path: '/me/settings',
						body: settings,
					},
					action
				)
			);
		}
	};
}

export function userSettingsSaveFailure( { settingsOverride }, error ) {
	if ( settingsOverride?.password ) {
		return [
			errorNotice( translate( 'There was a problem saving your password. Please, try again.' ), {
				id: 'save-user-settings',
			} ),
			saveUserSettingsFailure( settingsOverride, error ),
		];
	}

	if ( settingsOverride?.user_email_change_pending !== undefined ) {
		return [
			errorNotice(
				translate( 'There was a problem canceling the email change. Please, try again.' )
			),
			saveUserSettingsFailure( settingsOverride, error ),
		];
	}

	return [
		errorNotice( error.message || translate( 'There was a problem saving your changes.' ), {
			id: 'save-user-settings',
		} ),
		saveUserSettingsFailure( settingsOverride, error ),
	];
}

/*
 * After settings were successfully saved, update the settings stored in the Redux state,
 * clear the unsaved settings list, and re-fetch info about the user.
 */
export const userSettingsSaveSuccess =
	( { settingsOverride }, data ) =>
	async ( dispatch ) => {
		dispatch( saveUserSettingsSuccess( fromApi( data ) ) );
		dispatch(
			clearUnsavedUserSettings( settingsOverride ? Object.keys( settingsOverride ) : null )
		);

		// Refetch the user data after saving user settings
		await dispatch( fetchCurrentUser() );

		if ( settingsOverride?.user_email_change_pending !== undefined ) {
			dispatch( successNotice( translate( 'The email change has been successfully canceled.' ) ) );
			return;
		}

		dispatch(
			successNotice( translate( 'Settings saved successfully!' ), {
				id: 'save-user-settings',
			} )
		);
	};

registerHandlers( 'state/data-layer/wpcom/me/settings/index.js', {
	[ USER_SETTINGS_REQUEST ]: [
		dispatchRequest( {
			fetch: requestUserSettings,
			onSuccess: requestUserSettingsSuccess,
			onError: requestUserSettingsFailure,
			fromApi,
		} ),
	],
	[ USER_SETTINGS_SAVE ]: [
		dispatchRequest( {
			fetch: userSettingsSave,
			onSuccess: userSettingsSaveSuccess,
			onError: userSettingsSaveFailure,
			fromApi,
		} ),
	],
} );
