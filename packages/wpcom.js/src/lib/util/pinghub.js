import debugFactory from 'debug';

const debug = debugFactory( 'wpcom:pinghub' );

/**
 * Create a `Pinghub` instance
 *
 * @param {object} wpcom - wpcom instance
 * @returns {null} null
 */
export default function Pinghub( wpcom ) {
	if ( ! ( this instanceof Pinghub ) ) {
		return new Pinghub( wpcom );
	}

	this.wpcom = wpcom;
	this.conns = {};
}

/**
 * Open a websocket to Pinghub
 *
 * @param {string} path - request path
 * @param {Function} fn - callback function
 */
Pinghub.prototype.connect = function ( path, fn ) {
	debug( 'connect', path, fn );
	const pinghub = this;
	const params = {
		action: 'connect',
		path: '/pinghub' + path,
	};
	const errorCallback = function () {}; // we want an xhr, not a promise
	const xhr = ( this.conns[ path ] = this.wpcom.req.get( params, errorCallback ) );
	xhr.onload = function ( e ) {
		debug( 'onload', path, e );
		fn( null, e );
	};
	xhr.onerror =
		xhr.onabort =
		xhr.onclose =
			function ( e ) {
				debug( 'onerror', path, e );
				pinghub.remove( path );
				fn( e, null );
			};
};

/**
 * Close a websocket connection (unsubscribe)
 *
 * @param {string} path - request path
 */
Pinghub.prototype.disconnect = function ( path ) {
	debug( 'disconnect', path );
	const params = {
		action: 'disconnect',
		path: '/pinghub' + path,
	};
	const errorCallback = function () {}; // no promises
	this.wpcom.req.get( params, errorCallback );
};

/**
 * Remove a dead connection
 *
 * @param {string} path - pinghub channel
 */
Pinghub.prototype.remove = function ( path ) {
	debug( 'remove', path );
	delete this.conns[ path ];
};
