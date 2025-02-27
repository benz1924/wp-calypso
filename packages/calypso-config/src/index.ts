import createConfig from '@automattic/create-calypso-config';
import cookie from 'cookie';
import desktopOverride from './desktop';
import type { ConfigData } from '@automattic/create-calypso-config';

declare global {
	interface Window {
		configData: ConfigData;
		electron: any; // eslint-disable-line @typescript-eslint/no-explicit-any
	}
}

/**
 * Manages config flags for various deployment builds
 *
 * @module config/index
 */
if ( 'undefined' === typeof window || ! window.configData ) {
	throw new ReferenceError(
		'No configuration was found: please see packages/calypso-config/README.md for more information'
	);
}

const isDesktop = window.electron !== undefined;

let configData: ConfigData;

if ( isDesktop ) {
	configData = desktopOverride( window.configData );
} else {
	configData = window.configData;
}

// calypso.live matches
// hash-abcd1234.calypso.live matches
// calypso.live.com doesn't match
const CALYPSO_LIVE_REGEX = /^([a-zA-Z0-9-]+\.)?calypso\.live$/;

// check if the current browser location is *.calypso.live
export function isCalypsoLive(): boolean {
	return typeof window !== 'undefined' && CALYPSO_LIVE_REGEX.test( window.location.host );
}

function applyFlags( flagsString: string, modificationMethod: string ) {
	const flags = flagsString.split( ',' );
	flags.forEach( ( flagRaw ) => {
		const flag = flagRaw.replace( /^[-+]/, '' );
		const enabled = ! /^-/.test( flagRaw );
		if ( configData.features ) {
			configData.features[ flag ] = enabled;
			// eslint-disable-next-line no-console
			console.log(
				'%cConfig flag %s via %s: %s',
				'font-weight: bold;',
				enabled ? 'enabled' : 'disabled',
				modificationMethod,
				flag
			);
		}
	} );
}

const flagEnvironments = [ 'wpcalypso', 'horizon', 'stage', 'jetpack-cloud-stage' ];

if (
	process.env.NODE_ENV === 'development' ||
	flagEnvironments.includes( configData.env_id ) ||
	isCalypsoLive()
) {
	const cookies = cookie.parse( document.cookie );
	if ( cookies.flags ) {
		applyFlags( cookies.flags, 'cookie' );
	}

	try {
		const session = window.sessionStorage.getItem( 'flags' );
		if ( session ) {
			applyFlags( session, 'sessionStorage' );
		}
	} catch ( e ) {
		// in private context, accessing session storage can throw
	}

	const match =
		document.location.search && document.location.search.match( /[?&]flags=([^&]+)(&|$)/ );
	if ( match ) {
		applyFlags( decodeURIComponent( match[ 1 ] ), 'URL' );
	}
}
const configApi = createConfig( configData );
export default configApi;
export const isEnabled = configApi.isEnabled;
export const enabledFeatures = configApi.enabledFeatures;
export const enable = configApi.enable;
export const disable = configApi.disable;
