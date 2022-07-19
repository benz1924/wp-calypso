import { isEnabled } from '@automattic/calypso-config';
import {
	PLAN_PREMIUM,
	PLAN_WPCOM_PRO,
	WPCOM_DIFM_EXTRA_PAGE,
	WPCOM_DIFM_LITE,
} from '@automattic/calypso-products';
import formatCurrency from '@automattic/format-currency';
import { useShoppingCart } from '@automattic/shopping-cart';
import { LocalizeProps, useTranslate } from 'i18n-calypso';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import getCartKey from 'calypso/my-sites/checkout/get-cart-key';
import { getCurrentUserCurrencyCode } from 'calypso/state/currency-code/selectors';
import { buildDIFMCartExtrasObject } from 'calypso/state/difm/assemblers';
import { requestProductsList } from 'calypso/state/products-list/actions';
import { getProductBySlug } from 'calypso/state/products-list/selectors';
import { getSignupDependencyStore } from 'calypso/state/signup/dependency-store/selectors';
import { fetchSitePlans } from 'calypso/state/sites/plans/actions';
import { getSite } from 'calypso/state/sites/selectors';
import type { ResponseCart } from '@automattic/shopping-cart';
import type { ProductListItem } from 'calypso/state/products-list/selectors/get-products-list';
import type { TranslateResult } from 'i18n-calypso';

export type CartItem = {
	nameOverride?: TranslateResult;
	productSlug: string;
	productOriginalName: string;
	productCost: number;
	meta?: TranslateResult;
	productCount?: number;
	itemSubTotal: number;
};

const FREE_PAGES = 5;

type DummyCartParams = {
	selectedPages: string[];
	currencyCode: string;
	activePlanScheme: ProductListItem;
	difmLiteProduct: ProductListItem;
	extraPageProduct: ProductListItem;
	translate: LocalizeProps[ 'translate' ];
};

function getDummyCartProducts( {
	selectedPages,
	currencyCode,
	activePlanScheme,
	difmLiteProduct,
	extraPageProduct,
	translate,
}: DummyCartParams ): CartItem[] {
	const extraPageCount = Math.max( 0, selectedPages.length - FREE_PAGES );
	let displayedCartItems: CartItem[] = [];
	if ( difmLiteProduct && activePlanScheme && extraPageProduct ) {
		displayedCartItems = [
			{
				nameOverride: translate( 'Website Design Service' ),
				productSlug: difmLiteProduct.product_slug,
				productOriginalName: difmLiteProduct.product_name,
				itemSubTotal: difmLiteProduct.cost,
				productCost: difmLiteProduct.cost,
				meta: translate( 'One-time fee' ),
			},
			{
				productSlug: difmLiteProduct.product_slug,
				productOriginalName: activePlanScheme.product_name,
				itemSubTotal: activePlanScheme.cost,
				productCost: activePlanScheme.cost,
				meta: translate( 'Plan Subscription: %(planPrice)s per year', {
					args: {
						planPrice: formatCurrency( activePlanScheme.cost, currencyCode, { precision: 0 } ),
					},
				} ),
			},
			{
				nameOverride: translate( '%(numberOfPages)d Extra Page', '%(numberOfPages)d Extra Pages', {
					count: extraPageCount,
					args: { numberOfPages: extraPageCount },
				} ),

				productSlug: difmLiteProduct.product_slug,
				productOriginalName: extraPageProduct.product_name,
				productCost: extraPageProduct.cost,
				meta: translate( '%(perPageCost)s Per Page', {
					args: {
						perPageCost: formatCurrency( extraPageProduct.cost, currencyCode, { precision: 0 } ),
					},
				} ),
				itemSubTotal: extraPageProduct.cost * extraPageCount,
				productCount: extraPageCount,
			},
		];
	}

	return displayedCartItems;
}

function getSiteCartProducts( {
	responseCart,
	extraPageProduct,
	translate,
	currencyCode,
}: {
	responseCart: ResponseCart;
	extraPageProduct: ProductListItem;
	translate: LocalizeProps[ 'translate' ];
	currencyCode: string;
} ): CartItem[] {
	const cartItems: CartItem[] = responseCart.products.map( ( product ) => {
		switch ( product.product_slug ) {
			case PLAN_WPCOM_PRO:
			case PLAN_PREMIUM:
				return {
					productSlug: product.product_slug,
					productOriginalName: product.product_name,
					itemSubTotal: product.cost,
					productCost: product.cost,
					meta: translate( 'Plan Subscription: %(planPrice)s per year', {
						args: { planPrice: product.product_cost_display },
					} ),
				};
			case WPCOM_DIFM_LITE:
				return {
					productSlug: product.product_slug,
					nameOverride: translate( 'Website Design Service' ),
					productOriginalName: product.product_name,
					itemSubTotal: product.cost,
					productCost: product.cost,
					meta: translate( 'One-time fee' ),
				};
			case WPCOM_DIFM_EXTRA_PAGE:
				return {
					productSlug: product.product_slug,
					nameOverride: translate(
						'%(numberOfPages)d Extra Page',
						'%(numberOfPages)d Extra Pages',
						{
							count: product.quantity ?? 0,
							args: { numberOfPages: product.quantity },
						}
					),
					productOriginalName: product.product_name,
					itemSubTotal: product.cost,
					productCost: product.cost,
					meta: translate( '%(perPageCost)d Per Page', {
						args: { perPageCost: product.item_original_cost_for_quantity_one_display },
					} ),
				};

			default:
				return {
					productSlug: product.product_slug,
					nameOverride: translate( 'Website Design Service' ),
					productOriginalName: product.product_name,
					itemSubTotal: product.cost,
					productCost: product.cost,
					meta: translate( 'One-time fee' ),
				};
		}
	} );

	// Add a 0 line item product if there is no extra page in the cart
	if ( ! cartItems.some( ( c ) => c.productSlug === WPCOM_DIFM_EXTRA_PAGE ) ) {
		cartItems.push( {
			productSlug: extraPageProduct.product_slug,
			productOriginalName: extraPageProduct.product_name,
			itemSubTotal: 0,
			productCost: 0,
			nameOverride: translate( '0 Extra Pages' ),
			meta: translate( '%(perPageCost)s Per Page', {
				args: {
					perPageCost: formatCurrency( extraPageProduct.cost, currencyCode, { precision: 0 } ),
				},
			} ),
		} );
	}
	return cartItems;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const debounce = ( callback: ( ...args: any[] ) => any, timeout: number ) => {
	let timeoutId: number | undefined = undefined;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return ( ...args: any[] ) => {
		window.clearTimeout( timeoutId );
		timeoutId = window.setTimeout( () => {
			callback( ...args );
		}, timeout );
	};
};

export function useCartForDIFM( selectedPages: string[] ): {
	items: CartItem[];
	total: string | null;
	isLoading: boolean;
	isPendingUpdate: boolean;
	isCartUpdateStarted: boolean;
} {
	//This state is used by loader states to provide immediate feedback when a deebounced change happens to a cart
	const [ isCartUpdateStarted, setIsCartUpdateStarted ] = useState( false );

	const signupDependencies = useSelector( getSignupDependencyStore );
	const translate = useTranslate();
	const dispatch = useDispatch();
	const proPlan = useSelector( ( state ) => getProductBySlug( state, PLAN_WPCOM_PRO ) );
	const premiumPlan = useSelector( ( state ) => getProductBySlug( state, PLAN_PREMIUM ) );
	const activePremiumPlanScheme = isEnabled( 'plans/pro-plan' ) ? proPlan : premiumPlan;
	const { newOrExistingSiteChoice, siteId, siteSlug } = signupDependencies;

	const extraPageProduct = useSelector( ( state ) =>
		getProductBySlug( state, WPCOM_DIFM_EXTRA_PAGE )
	);
	const difmLiteProduct = useSelector( ( state ) => getProductBySlug( state, WPCOM_DIFM_LITE ) );

	const currencyCode = useSelector( getCurrentUserCurrencyCode );

	const site = useSelector( ( state ) => getSite( state, siteSlug ?? siteId ) );
	const cartKey = getCartKey( { selectedSite: site } );

	const { replaceProductsInCart, responseCart, isLoading, isPendingUpdate } = useShoppingCart(
		cartKey ?? undefined
	);

	const getDifmLiteCartProduct = useCallback( () => {
		if ( difmLiteProduct ) {
			return {
				...difmLiteProduct,
				extra: buildDIFMCartExtrasObject( {
					...signupDependencies,
					selectedPageTitles: selectedPages,
				} ),
			};
		}
		return null;
	}, [ signupDependencies, selectedPages, difmLiteProduct ] );

	useEffect( () => {
		// As soon as page selection changes show some loading feedback to the user
		setIsCartUpdateStarted( true );
	}, [ setIsCartUpdateStarted, selectedPages ] );

	useEffect( () => {
		siteId && dispatch( fetchSitePlans( siteId ) );
		if ( ! difmLiteProduct || ! extraPageProduct ) {
			dispatch( requestProductsList() );
		}
	}, [ dispatch, siteId, difmLiteProduct, extraPageProduct ] );

	const debouncedReplaceProductsInCart = useMemo(
		() =>
			debounce( async ( products ) => {
				await replaceProductsInCart( products );
				// Switch off loading feedback once basket is properly updated
				setIsCartUpdateStarted( false );
			}, 800 ),
		[ replaceProductsInCart ]
	);

	useEffect( () => {
		if ( newOrExistingSiteChoice === 'existing-site' ) {
			const difmLiteProduct = getDifmLiteCartProduct();
			if ( difmLiteProduct && difmLiteProduct.product_slug ) {
				debouncedReplaceProductsInCart( [ difmLiteProduct ] );
			}
		}
	}, [ newOrExistingSiteChoice, getDifmLiteCartProduct, debouncedReplaceProductsInCart ] );

	let displayedCartItems: CartItem[] = [];
	if ( extraPageProduct && difmLiteProduct && activePremiumPlanScheme && currencyCode ) {
		if ( newOrExistingSiteChoice === 'existing-site' ) {
			displayedCartItems = getSiteCartProducts( {
				responseCart,
				translate,
				extraPageProduct,
				currencyCode: currencyCode,
			} );
		} else {
			displayedCartItems = getDummyCartProducts( {
				selectedPages,
				currencyCode: currencyCode,
				translate,
				activePlanScheme: activePremiumPlanScheme,
				difmLiteProduct,
				extraPageProduct,
			} );
		}
	}

	const totalCost = displayedCartItems.reduce(
		( total, currentProduct ) => currentProduct.itemSubTotal + total,
		0
	);
	const totalCostFormatted = formatCurrency( totalCost, currencyCode ?? 'USD', { precision: 0 } );

	return {
		items: displayedCartItems,
		total: totalCostFormatted,
		isLoading,
		isPendingUpdate,
		isCartUpdateStarted,
	};
}

export default useCartForDIFM;
