import { registerStore } from '@wordpress/data';
import debugFactory from 'debug';
import { maskField } from 'calypso/lib/checkout';
import type {
	CardFieldState,
	CardStoreState,
	CardStoreType,
	CardStoreAction,
	CardElementType,
} from './types';
import type { DispatchFromMap, SelectFromMap } from '@automattic/data-stores';
import type { StoreStateValue } from '@automattic/wpcom-checkout';

const debug = debugFactory( 'calypso:composite-checkout:credit-card' );

declare module '@wordpress/data' {
	function dispatch( key: 'wpcom-credit-card' ): DispatchFromMap< typeof actions >;
	function select( key: 'wpcom-credit-card' ): SelectFromMap< typeof selectors >;
}

export const actions = {
	changeBrand( payload: string ): CardStoreAction {
		return { type: 'BRAND_SET', payload };
	},
	setCardDataError( type: CardElementType, message: string | null ): CardStoreAction {
		return { type: 'CARD_DATA_ERROR_SET', payload: { type, message } };
	},
	setCardDataComplete( type: CardElementType, complete: boolean ): CardStoreAction {
		return { type: 'CARD_DATA_COMPLETE_SET', payload: { type, complete } };
	},
	setFieldValue( key: string, value: string ): CardStoreAction {
		return { type: 'FIELD_VALUE_SET', payload: { key, value } };
	},
	setFieldError( key: string, message: string ): CardStoreAction {
		return { type: 'FIELD_ERROR_SET', payload: { key, message } };
	},
	setUseForAllSubscriptions( payload: boolean ): CardStoreAction {
		return { type: 'USE_FOR_ALL_SUBSCRIPTIONS_SET', payload };
	},
	touchAllFields(): CardStoreAction {
		return { type: 'TOUCH_ALL_FIELDS' };
	},
};

export const selectors = {
	getBrand( state: CardStoreState ): string {
		return state.brand || '';
	},
	getCardDataErrors( state: CardStoreState ) {
		return state.cardDataErrors;
	},
	getIncompleteFieldKeys( state: CardStoreState ): CardElementType[] {
		return Object.keys( state.cardDataComplete ).filter(
			( key ) => ! state.cardDataComplete[ key as CardElementType ]
		) as CardElementType[];
	},
	getFields( state: CardStoreState ) {
		return state.fields;
	},
	useForAllSubscriptions( state: CardStoreState ) {
		return state.useForAllSubscriptions;
	},
};

export function createCreditCardPaymentMethodStore( {
	initialUseForAllSubscriptions,
	allowUseForAllSubscriptions,
}: {
	initialUseForAllSubscriptions?: boolean;
	allowUseForAllSubscriptions?: boolean;
} ): CardStoreType {
	debug( 'creating a new credit card payment method store' );

	function fieldReducer( state: CardFieldState = {}, action?: CardStoreAction ) {
		switch ( action?.type ) {
			case 'FIELD_VALUE_SET':
				return {
					...state,
					[ action.payload.key ]: {
						value: maskField(
							action.payload.key,
							state[ action.payload.key ]?.value,
							action.payload.value
						),
						isTouched: true,
						errors: [],
					},
				};
			case 'FIELD_ERROR_SET': {
				return {
					...state,
					[ action.payload.key ]: {
						...state[ action.payload.key ],
						errors: [ action.payload.message ],
					},
				};
			}
			case 'TOUCH_ALL_FIELDS': {
				return Object.keys( state ).reduce(
					( obj: Record< string, StoreStateValue >, key: string ) => {
						obj[ key ] = {
							value: state[ key ].value,
							isTouched: true,
						};
						return obj;
					},
					{}
				);
			}
			default:
				return state;
		}
	}

	function cardDataCompleteReducer(
		state = {
			cardNumber: false,
			cardCvc: false,
			cardExpiry: false,
		},
		action?: CardStoreAction
	) {
		switch ( action?.type ) {
			case 'CARD_DATA_COMPLETE_SET':
				return { ...state, [ action.payload.type ]: action.payload.complete };
			default:
				return state;
		}
	}

	function cardDataErrorsReducer( state = {}, action?: CardStoreAction ) {
		switch ( action?.type ) {
			case 'CARD_DATA_ERROR_SET':
				return { ...state, [ action.payload.type ]: action.payload.message };
			default:
				return state;
		}
	}

	function brandReducer( state: string | null | undefined = null, action?: CardStoreAction ) {
		switch ( action?.type ) {
			case 'BRAND_SET':
				return action.payload;
			default:
				return state;
		}
	}

	function allSubscriptionsReducer( state: boolean, action?: CardStoreAction ) {
		switch ( action?.type ) {
			case 'USE_FOR_ALL_SUBSCRIPTIONS_SET':
				return action.payload;
			default:
				return state;
		}
	}

	function getInitialUseForAllSubscriptionsValue() {
		if ( ! allowUseForAllSubscriptions ) {
			return false;
		}
		if ( initialUseForAllSubscriptions !== undefined ) {
			return initialUseForAllSubscriptions;
		}
		return false;
	}

	return registerStore( 'wpcom-credit-card', {
		reducer(
			state = {
				fields: fieldReducer(),
				cardDataErrors: cardDataErrorsReducer(),
				cardDataComplete: cardDataCompleteReducer(),
				brand: brandReducer(),
				useForAllSubscriptions: getInitialUseForAllSubscriptionsValue(),
			},
			action
		) {
			return {
				fields: fieldReducer( state.fields, action ),
				cardDataErrors: cardDataErrorsReducer( state.cardDataErrors, action ),
				cardDataComplete: cardDataCompleteReducer( state.cardDataComplete, action ),
				brand: brandReducer( state.brand, action ),
				useForAllSubscriptions: allowUseForAllSubscriptions
					? allSubscriptionsReducer( state.useForAllSubscriptions, action )
					: false,
			};
		},
		actions,
		selectors,
	} );
}
