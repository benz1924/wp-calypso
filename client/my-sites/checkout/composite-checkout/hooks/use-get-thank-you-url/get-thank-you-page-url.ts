import {
	JETPACK_PRODUCTS_LIST,
	JETPACK_RESET_PLANS,
	JETPACK_REDIRECT_URL,
	PLAN_BUSINESS,
	redirectCheckoutToWpAdmin,
	findFirstSimilarPlanKey,
	getPlan,
	isPlan,
	isWpComPremiumPlan,
	isTitanMail,
} from '@automattic/calypso-products';
import {
	URL_TYPE,
	determineUrlType,
	format as formatUrl,
	getUrlParts,
	getUrlFromParts,
} from '@automattic/calypso-url';
import debugFactory from 'debug';
import {
	hasRenewalItem,
	getAllCartItems,
	getDomainRegistrations,
	getRenewalItems,
	hasConciergeSession,
	hasJetpackPlan,
	hasBloggerPlan,
	hasPersonalPlan,
	hasPremiumPlan,
	hasBusinessPlan,
	hasEcommercePlan,
	hasGoogleApps,
	hasTitanMail,
	hasTrafficGuide,
	hasDIFMProduct,
	hasProPlan,
} from 'calypso/lib/cart-values/cart-items';
import isJetpackCloud from 'calypso/lib/jetpack/is-jetpack-cloud';
import { isValidFeatureKey } from 'calypso/lib/plans/features-list';
import { getEligibleTitanDomain } from 'calypso/lib/titan';
import { addQueryArgs, isExternal, resemblesUrl } from 'calypso/lib/url';
import { managePurchase } from 'calypso/me/purchases/paths';
import {
	clearSignupCompleteFlowName,
	getSignupCompleteFlowName,
	persistSignupDestination,
	retrieveSignupDestination,
} from 'calypso/signup/storageUtils';
import type { ResponseCart, ResponseCartProduct } from '@automattic/shopping-cart';
import type { ResponseDomain } from 'calypso/lib/domains/types';

const debug = debugFactory( 'calypso:composite-checkout:get-thank-you-page-url' );

type SaveUrlToCookie = ( url: string ) => void;
type GetUrlFromCookie = () => string | undefined;

type OrderId = number;
type PurchaseId = number;
type ReceiptId = number;
type ReceiptIdPlaceholder = ':receiptId';
type PendingOrderPathFragment = `pending/${ OrderId }`;
type PendingOrReceiptId = PendingOrderPathFragment | ReceiptIdPlaceholder | PurchaseId | ReceiptId;

function isReceiptIdOrPlaceholder(
	receiptId: PendingOrReceiptId
): receiptId is ReceiptId | ReceiptIdPlaceholder {
	if ( Number.isInteger( receiptId ) || receiptId === ':receiptId' ) {
		return true;
	}
	return false;
}

/**
 * Determine where to send the user after checkout is complete.
 *
 * This logic is complex and in many cases quite old. To keep it functional and
 * comprehensible and to prevent regressions, all possible outputs are covered
 * by unit tests in
 * `client/my-sites/checkout/composite-checkout/test/composite-checkout-thank-you`.
 *
 * IF YOU CHANGE THIS FUNCTION ALSO CHANGE THE TESTS!
 *
 * IMPORTANT NOTE: this function must be called BEFORE checkout is complete
 * because redirect payment methods like PayPal send the user to the URL
 * returned by this function directly, so the URL must be generated and passed
 * to PayPal before the transaction begins.
 */
export default function getThankYouPageUrl( {
	siteSlug,
	adminUrl,
	redirectTo,
	receiptId,
	noPurchaseMade,
	orderId,
	purchaseId,
	feature,
	cart,
	isJetpackNotAtomic,
	productAliasFromUrl,
	getUrlFromCookie = retrieveSignupDestination,
	saveUrlToCookie = persistSignupDestination,
	isEligibleForSignupDestinationResult,
	hideNudge,
	isInModal,
	isJetpackCheckout = false,
	jetpackTemporarySiteId,
	adminPageRedirect,
	domains,
}: {
	siteSlug?: string;
	adminUrl?: string;
	redirectTo?: string;
	receiptId?: number | string;
	noPurchaseMade?: boolean;
	orderId?: number | string;
	purchaseId?: number | string;
	feature?: string;
	cart?: ResponseCart;
	isJetpackNotAtomic?: boolean;
	productAliasFromUrl?: string;
	getUrlFromCookie?: GetUrlFromCookie;
	saveUrlToCookie?: SaveUrlToCookie;
	isEligibleForSignupDestinationResult?: boolean;
	hideNudge?: boolean;
	isInModal?: boolean;
	isJetpackCheckout?: boolean;
	jetpackTemporarySiteId?: string;
	adminPageRedirect?: string;
	domains?: ResponseDomain[];
} ): string {
	debug( 'starting getThankYouPageUrl' );

	// If we're given an explicit `redirectTo` query arg, make sure it's either internal
	// (i.e. on WordPress.com), the same site as the cart's site, a Jetpack cloud URL,
	// or a Jetpack or WP.com site's block editor (in wp-admin). This is required for Jetpack's
	// (and WP.com's) paid blocks Upgrade Nudge.
	if ( redirectTo ) {
		const { protocol, hostname, port, pathname, searchParams } = getUrlParts( redirectTo );

		if ( resemblesUrl( redirectTo ) && isRedirectSameSite( redirectTo, siteSlug ) ) {
			debug( 'has same site redirectTo, so returning that', redirectTo );
			return redirectTo;
		}
		if ( ! isExternal( redirectTo ) ) {
			debug( 'has a redirectTo that is not external, so returning that', redirectTo );
			return redirectTo;
		}
		// We cannot simply compare `hostname` to `siteSlug`, since the latter
		// might contain a path in the case of Jetpack subdirectory installs.
		if ( adminUrl && redirectTo.startsWith( `${ adminUrl }post.php?` ) ) {
			const sanitizedRedirectTo = getUrlFromParts( {
				protocol: protocol,
				hostname: hostname,
				port: port,
				pathname: pathname,
				searchParams: new URLSearchParams( {
					post: searchParams.get( 'post' ) as string,
					action: 'edit',
					plan_upgraded: '1',
				} ),
			} ).href;
			debug( 'returning sanitized internal redirectTo', sanitizedRedirectTo );
			return sanitizedRedirectTo;
		}

		if ( hostname === 'cloud.jetpack.com' || hostname === 'jetpack.cloud.localhost' ) {
			debug( 'returning Jetpack cloud redirectTo', redirectTo );
			return redirectTo;
		}

		debug( 'ignorning redirectTo', redirectTo );
	}

	// If there's a redirect URL set on a product in the cart, use the most recent one.
	const urlFromCart = cart ? getRedirectUrlFromCart( cart ) : null;
	if ( urlFromCart ) {
		debug( 'returning url from cart', urlFromCart );
		return urlFromCart;
	}

	// Note: this function is called early on for redirect payment methods like
	// PayPal, when the receipt isn't set yet.
	//
	// For redirect payment methods like Bancontact or PayPal, the `return_url`
	// submitted to the payment partner (Stripe or PayPal) actually redirects to
	// a pseudo-endpoint (`/me/transactions/source-payment` or
	// `/me/transactions/paypal-express`) on `public-api.wordpress.com`.
	//
	// That pseudo-endpoint performs various duties and then uses a 302 redirect
	// to send the browser to the `success_url` originally sent by checkout to
	// start the transaction (to either the `/me/transactions` or
	// `/me/paypal-express-url` endpoint). That URL sometimes is for the calypso
	// "pending" page (`/checkout/thank-you/:site/pending/:orderId`) which
	// requires an order ID and its own `redirectTo` query param.
	//
	// The pseudo-endpoint modifies the `success_url` to add that order ID and to
	// replace the `:receiptId` placeholder with the actual receipt ID for the
	// transaction. The pending page (the `CheckoutPending` component in calypso)
	// then redirects the browser to the receipt page.
	//
	// If the receipt does not yet exist, then the pending page polls the orders
	// endpoint (`/me/transactions/order/:orderId`) for the transaction data,
	// then replaces the `:receiptId` placeholder itself and redirects to the
	// receipt page.
	const pendingOrReceiptId = getPendingOrReceiptId( receiptId, orderId, purchaseId );
	debug( 'pendingOrReceiptId is', pendingOrReceiptId );

	// jetpack userless & siteless checkout uses a special thank you page
	if ( isJetpackCheckout ) {
		// extract a product from the cart, in userless/siteless checkout there should only be one
		const productSlug = cart?.products[ 0 ]?.product_slug ?? 'no_product';

		if ( siteSlug ) {
			debug( 'redirecting to userless jetpack thank you' );
			return `/checkout/jetpack/thank-you/${ siteSlug }/${ productSlug }`;
		}

		// siteless checkout
		debug( 'redirecting to siteless jetpack thank you' );
		const thankYouUrl = `/checkout/jetpack/thank-you/licensing-auto-activate/${ productSlug }`;

		return addQueryArgs(
			{
				receiptId: isReceiptIdOrPlaceholder( pendingOrReceiptId ) ? pendingOrReceiptId : undefined,
				siteId: jetpackTemporarySiteId && parseInt( jetpackTemporarySiteId ),
			},
			thankYouUrl
		);
	}

	const fallbackUrl = getFallbackDestination( {
		pendingOrReceiptId,
		noPurchaseMade,
		siteSlug,
		adminUrl,
		feature,
		cart,
		isJetpackNotAtomic: Boolean( isJetpackNotAtomic ),
		productAliasFromUrl,
		adminPageRedirect,
		redirectTo,
	} );
	debug( 'fallbackUrl is', fallbackUrl );

	// If there is no purchase, then send the user to a generic page (not
	// post-purchase related). For example, this case arises when a Skip button
	// is clicked on a concierge upsell nudge opened by a direct link to
	// /checkout/offer-support-session.
	if ( noPurchaseMade ) {
		debug( 'there was no purchase, so returning: ', fallbackUrl );
		return fallbackUrl;
	}

	saveUrlToCookieIfEcomm( saveUrlToCookie, cart, fallbackUrl );

	// If the user is making a purchase/upgrading within the editor,
	// we want to return them back to the editor after the purchase is successful.
	if ( isInModal && cart && ! hasEcommercePlan( cart ) ) {
		saveUrlToCookie( window?.location.href );
	}

	modifyCookieUrlIfAtomic( getUrlFromCookie, saveUrlToCookie, siteSlug );

	// Fetch the thank-you page url from a cookie if it is set
	const urlFromCookie = getUrlFromCookie();
	debug( 'cookie url is', urlFromCookie );

	if ( cart && hasRenewalItem( cart ) && siteSlug ) {
		const renewalItem: ResponseCartProduct = getRenewalItems( cart )[ 0 ];
		if ( renewalItem && renewalItem.subscription_id ) {
			const managePurchaseUrl = managePurchase( siteSlug, renewalItem.subscription_id );
			debug(
				'renewal item in cart',
				renewalItem,
				'so returning managePurchaseUrl',
				managePurchaseUrl
			);
			return managePurchaseUrl;
		}
	}

	const signupFlowName = getSignupCompleteFlowName();

	// Domain only flow
	if ( cart?.create_new_blog || signupFlowName === 'domain' ) {
		clearSignupCompleteFlowName();
		const newBlogReceiptUrl = urlFromCookie
			? `${ urlFromCookie }/${ pendingOrReceiptId }`
			: fallbackUrl;
		debug( 'new blog created, so returning', newBlogReceiptUrl );
		// Skip composed url if we have to redirect to intent flow
		if ( ! newBlogReceiptUrl.includes( '/start/setup-site' ) ) {
			return newBlogReceiptUrl;
		}
	}

	if ( isReceiptIdOrPlaceholder( pendingOrReceiptId ) ) {
		const redirectUrlForPostCheckoutUpsell = getRedirectUrlForPostCheckoutUpsell( {
			receiptId: pendingOrReceiptId,
			cart,
			siteSlug,
			hideUpsell: Boolean( hideNudge ),
			domains,
		} );

		if ( redirectUrlForPostCheckoutUpsell ) {
			debug(
				'redirect for post-checkout upsell exists, so returning',
				redirectUrlForPostCheckoutUpsell
			);

			return redirectUrlForPostCheckoutUpsell;
		}
	}

	// Display mode is used to show purchase specific messaging, for e.g. the Schedule Session button
	// when purchasing a concierge session or when purchasing the Ultimate Traffic Guide
	const displayModeParam = getDisplayModeParamFromCart( cart );

	const thankYouPageUrlForTrafficGuide = getThankYouPageUrlForTrafficGuide( {
		cart,
		siteSlug,
		pendingOrReceiptId,
	} );
	if ( thankYouPageUrlForTrafficGuide ) {
		return getUrlWithQueryParam( thankYouPageUrlForTrafficGuide, displayModeParam );
	}

	if ( isEligibleForSignupDestinationResult && urlFromCookie ) {
		debug( 'is eligible for signup destination', urlFromCookie );
		const noticeType = getNoticeType( cart );
		const queryParams = { ...displayModeParam, ...noticeType };
		return getUrlWithQueryParam( urlFromCookie, queryParams );
	}
	debug( 'returning fallback url', fallbackUrl );
	return getUrlWithQueryParam( fallbackUrl, displayModeParam );
}

function getPendingOrReceiptId(
	receiptId: string | number | undefined,
	orderId: string | number | undefined,
	purchaseId: string | number | undefined
): PendingOrReceiptId {
	if ( receiptId ) {
		return Number( receiptId );
	}
	if ( orderId ) {
		return `pending/${ Number( orderId ) }`;
	}
	if ( purchaseId ) {
		return Number( purchaseId );
	}
	return ':receiptId';
}

function getFallbackDestination( {
	pendingOrReceiptId,
	noPurchaseMade,
	siteSlug,
	adminUrl,
	feature,
	cart,
	isJetpackNotAtomic,
	productAliasFromUrl,
	adminPageRedirect,
	redirectTo,
}: {
	pendingOrReceiptId: PendingOrReceiptId;
	noPurchaseMade?: boolean;
	siteSlug: string | undefined;
	adminUrl: string | undefined;
	feature: string | undefined;
	cart: ResponseCart | undefined;
	isJetpackNotAtomic: boolean;
	productAliasFromUrl: string | undefined;
	adminPageRedirect?: string;
	redirectTo?: string;
} ): string {
	const isCartEmpty = cart ? getAllCartItems( cart ).length === 0 : true;
	const isReceiptEmpty = ':receiptId' === pendingOrReceiptId;

	if ( noPurchaseMade ) {
		debug( 'fallback is just root' );
		return '/';
	}

	// We will show the Thank You page if there's a site slug and either one of the following is true:
	// - has a receipt number (or a pending order)
	// - does not have a receipt number but has an item in cart(as in the case of paying with a redirect payment type)
	if ( siteSlug && ( ! isReceiptEmpty || ! isCartEmpty ) ) {
		// If we just purchased a Jetpack product or a Jetpack plan (either Jetpack Security or Jetpack Complete),
		// redirect to the my plans page. The product being purchased can come from the `product` prop or from the
		// cart so we need to check both places.
		const productsWithCustomThankYou = [ ...JETPACK_PRODUCTS_LIST, ...JETPACK_RESET_PLANS ];

		// Check the cart (since our Thank You modal doesn't support multiple products, we only take the first
		// one found).
		const productFromCart = cart?.products?.find( ( { product_slug } ) =>
			( productsWithCustomThankYou as ReadonlyArray< string > ).includes( product_slug )
		)?.product_slug;

		const purchasedProduct =
			productFromCart ||
			productsWithCustomThankYou.find(
				( productWithCustom ) => productWithCustom === productAliasFromUrl
			);
		if ( isJetpackNotAtomic && purchasedProduct ) {
			debug( 'the site is jetpack and bought a jetpack product', siteSlug, purchasedProduct );

			const adminPath =
				redirectTo || adminPageRedirect || 'admin.php?page=jetpack#/recommendations';

			// Jetpack Cloud will either redirect to wp-admin (if JETPACK_REDIRECT_CHECKOUT_TO_WPADMIN
			// flag is set), or otherwise will redirect to a Jetpack Redirect API url (source=jetpack-checkout-thankyou)
			if ( isJetpackCloud() ) {
				if ( redirectCheckoutToWpAdmin() && adminUrl ) {
					debug( 'checkout is Jetpack Cloud, returning wp-admin url' );
					return adminUrl + adminPath;
				}
				debug( 'checkout is Jetpack Cloud, returning Jetpack Redirect API url' );
				return `${ JETPACK_REDIRECT_URL }&site=${ siteSlug }&query=${ encodeURIComponent(
					`product=${ purchasedProduct }&thank-you=true`
				) }`;
			}
			// Otherwise if not Jetpack Cloud:
			return redirectCheckoutToWpAdmin() && adminUrl
				? adminUrl + adminPath
				: `/plans/my-plan/${ siteSlug }?thank-you=true&product=${ purchasedProduct }`;
		}

		// If we just purchased a legacy Jetpack plan, redirect to the Jetpack onboarding plugin install flow.
		if ( isJetpackNotAtomic ) {
			debug( 'the site is jetpack and has no jetpack product' );
			return `/plans/my-plan/${ siteSlug }?thank-you=true&install=all`;
		}

		const getSimpleThankYouUrl = (): string => {
			debug( 'attempt to add extra information as url query string' );
			const titanProducts = cart?.products?.filter( ( product ) => isTitanMail( product ) );

			if ( titanProducts && titanProducts.length > 0 ) {
				const emails = titanProducts[ 0 ].extra?.email_users;

				if ( emails && emails.length > 0 ) {
					return `/checkout/thank-you/${ siteSlug }/${ pendingOrReceiptId }?email=${ emails[ 0 ].email }`;
				}
			}
			return `/checkout/thank-you/${ siteSlug }/${ pendingOrReceiptId }`;
		};

		if ( feature && isValidFeatureKey( feature ) ) {
			debug( 'site with receipt or cart; feature is', feature );
			if ( isReceiptIdOrPlaceholder( pendingOrReceiptId ) ) {
				return `/checkout/thank-you/features/${ feature }/${ siteSlug }/${ pendingOrReceiptId }`;
			}
			return `/checkout/thank-you/features/${ feature }/${ siteSlug }`;
		}
		return getSimpleThankYouUrl();
	}

	if ( siteSlug ) {
		debug( 'just site slug', siteSlug );
		return `/checkout/thank-you/${ siteSlug }`;
	}

	debug( 'fallback is just root' );
	return '/';
}

/**
 * This function returns the product slug of the next higher plan of the plan item in the cart.
 * Currently, it only supports premium plans.
 *
 * @param {ResponseCart} cart the cart object
 * @returns {string|undefined} the product slug of the next higher plan if it exists, undefined otherwise.
 */
function getNextHigherPlanSlug( cart: ResponseCart ): string | undefined {
	const currentPlanSlug = cart && getAllCartItems( cart ).filter( isPlan )[ 0 ]?.product_slug;
	if ( ! currentPlanSlug ) {
		return;
	}

	const currentPlan = getPlan( currentPlanSlug );

	if ( isWpComPremiumPlan( currentPlanSlug ) ) {
		const planKey = findFirstSimilarPlanKey( PLAN_BUSINESS, { term: currentPlan?.term } );
		return planKey ? getPlan( planKey )?.getPathSlug?.() : undefined;
	}

	return;
}

function getPlanUpgradeUpsellUrl( {
	receiptId,
	cart,
	siteSlug,
}: {
	receiptId: ReceiptId | ReceiptIdPlaceholder;
	cart: ResponseCart | undefined;
	siteSlug: string | undefined;
} ): string | undefined {
	if ( cart && hasPremiumPlan( cart ) ) {
		const upgradeItem = getNextHigherPlanSlug( cart );

		if ( upgradeItem ) {
			return `/checkout/${ siteSlug }/offer-plan-upgrade/${ upgradeItem }/${ receiptId }`;
		}
	}

	return;
}

function getRedirectUrlForPostCheckoutUpsell( {
	receiptId,
	cart,
	siteSlug,
	hideUpsell,
	domains,
}: {
	receiptId: ReceiptId | ReceiptIdPlaceholder;
	cart: ResponseCart | undefined;
	siteSlug: string | undefined;
	hideUpsell: boolean;
	domains: ResponseDomain[] | undefined;
} ): string | undefined {
	if ( hideUpsell ) {
		return;
	}
	const professionalEmailUpsellUrl = getProfessionalEmailUpsellUrl( {
		receiptId,
		cart,
		siteSlug,
		domains,
	} );

	if ( professionalEmailUpsellUrl ) {
		return professionalEmailUpsellUrl;
	}

	if (
		cart &&
		! hasJetpackPlan( cart ) &&
		! hasDIFMProduct( cart ) &&
		( hasBloggerPlan( cart ) ||
			hasPersonalPlan( cart ) ||
			hasPremiumPlan( cart ) ||
			hasBusinessPlan( cart ) )
	) {
		// A user just purchased one of the qualifying plans

		const planUpgradeUpsellUrl = getPlanUpgradeUpsellUrl( {
			receiptId,
			cart,
			siteSlug,
		} );

		if ( planUpgradeUpsellUrl ) {
			return planUpgradeUpsellUrl;
		}
	}
}

function getProfessionalEmailUpsellUrl( {
	receiptId,
	cart,
	siteSlug,
	domains,
}: {
	receiptId: ReceiptId | ReceiptIdPlaceholder;
	cart: ResponseCart | undefined;
	siteSlug: string | undefined;
	domains: ResponseDomain[] | undefined;
} ): string | undefined {
	if ( ! cart ) {
		return;
	}

	if ( hasGoogleApps( cart ) || hasTitanMail( cart ) ) {
		return;
	}

	if ( hasPremiumPlan( cart ) ) {
		return;
	}

	if (
		! hasBloggerPlan( cart ) &&
		! hasPersonalPlan( cart ) &&
		! hasBusinessPlan( cart ) &&
		! hasEcommercePlan( cart ) &&
		! hasProPlan( cart )
	) {
		return;
	}

	const domainRegistrations = getDomainRegistrations( cart );

	let domainName = null;

	// Uses either a domain being purchased, or the first domain eligible found in site domains
	if ( domainRegistrations.length > 0 ) {
		domainName = domainRegistrations[ 0 ].meta;
	} else if ( siteSlug && domains ) {
		const domain = getEligibleTitanDomain( siteSlug, domains, true );

		if ( domain ) {
			domainName = domain.name;
		}
	}

	if ( ! domainName ) {
		return;
	}

	return `/checkout/offer-professional-email/${ domainName }/${ receiptId }/${ siteSlug }`;
}

function getDisplayModeParamFromCart( cart: ResponseCart | undefined ): Record< string, string > {
	if ( cart && hasConciergeSession( cart ) ) {
		return { d: 'concierge' };
	}
	if ( cart && hasTrafficGuide( cart ) ) {
		return { d: 'traffic-guide' };
	}
	return {};
}

function getNoticeType( cart: ResponseCart | undefined ): Record< string, string > {
	if ( cart ) {
		return { notice: 'purchase-success' };
	}

	return {};
}

function getUrlWithQueryParam( url = '/', queryParams: Record< string, string > = {} ): string {
	const urlType = determineUrlType( url );
	if ( urlType === URL_TYPE.INVALID || urlType === URL_TYPE.PATH_RELATIVE ) {
		return url;
	}
	const { search, origin, host, ...parsedURL } = getUrlParts( url );

	// getUrlFromParts can only handle absolute URLs, so add dummy data if needed.
	// formatUrl will remove it away, to match the previous url type.
	parsedURL.protocol = parsedURL.protocol || 'https:';
	parsedURL.hostname = parsedURL.hostname || '__domain__.invalid';

	const urlParts = {
		...parsedURL,
		searchParams: new URLSearchParams( {
			...Object.fromEntries( new URLSearchParams( search ) ),
			...queryParams,
		} ),
	};

	return formatUrl( getUrlFromParts( urlParts ), urlType );
}

/**
 * If there is an ecommerce plan in cart, then irrespective of the signup flow destination, the final destination
 * will always be "Thank You" page for the eCommerce plan. This is because the ecommerce store setup happens in this page.
 * If the user purchases additional products via upsell nudges, the original saved receipt ID will be used to
 * display the Thank You page for the eCommerce plan purchase.
 *
 * @param {Function} saveUrlToCookie The function that performs the saving
 * @param {object} cart The cart object
 * @param {string} destinationUrl The url to save
 */
function saveUrlToCookieIfEcomm(
	saveUrlToCookie: SaveUrlToCookie,
	cart: ResponseCart | undefined,
	destinationUrl: string
): void {
	if ( cart && hasEcommercePlan( cart ) ) {
		saveUrlToCookie( destinationUrl );
	}
}

function modifyUrlIfAtomic( siteSlug: string | undefined, url: string ): string {
	// If atomic site, then replace wordpress.com with wpcomstaging.com
	if ( siteSlug?.includes( '.wpcomstaging.com' ) ) {
		return url.replace( /\b.wordpress.com/, '.wpcomstaging.com' );
	}
	return url;
}

function modifyCookieUrlIfAtomic(
	getUrlFromCookie: GetUrlFromCookie,
	saveUrlToCookie: SaveUrlToCookie,
	siteSlug: string | undefined
): void {
	const urlFromCookie = getUrlFromCookie();
	if ( ! urlFromCookie ) {
		return;
	}
	const updatedUrl = modifyUrlIfAtomic( siteSlug, urlFromCookie );

	if ( updatedUrl !== urlFromCookie ) {
		saveUrlToCookie( updatedUrl );
	}
}

function getThankYouPageUrlForTrafficGuide( {
	cart,
	siteSlug,
	pendingOrReceiptId,
}: {
	cart: ResponseCart | undefined;
	siteSlug: string | undefined;
	pendingOrReceiptId: PendingOrReceiptId;
} ) {
	if ( ! cart ) return;
	if ( hasTrafficGuide( cart ) ) {
		return `/checkout/thank-you/${ siteSlug }/${ pendingOrReceiptId }`;
	}
}

function getRedirectUrlFromCart( cart: ResponseCart ): string | null {
	const firstProductWithUrl = cart.products.reduce(
		( mostRecent: ResponseCartProduct | null, product: ResponseCartProduct ) => {
			if ( product.extra?.afterPurchaseUrl ) {
				if ( ! mostRecent ) {
					return product;
				}
				if ( product.time_added_to_cart > mostRecent.time_added_to_cart ) {
					return product;
				}
			}
			return mostRecent;
		},
		null
	);
	debug(
		'looking for redirect url in cart products found',
		firstProductWithUrl?.extra.afterPurchaseUrl
	);
	return firstProductWithUrl?.extra.afterPurchaseUrl ?? null;
}

function isRedirectSameSite( redirectTo: string, siteSlug?: string ) {
	if ( ! siteSlug ) {
		return false;
	}
	const { hostname, pathname } = getUrlParts( redirectTo );
	// For subdirectory site, check that both hostname and subdirectory matches the siteSlug (host.name::subdirectory).
	if ( siteSlug.indexOf( '::' ) !== -1 ) {
		const slugParts = siteSlug.split( '::' );
		const hostnameFromSlug = slugParts[ 0 ];
		const subDirectoryPathFromSlug = slugParts.splice( 1 ).join( '/' );
		return (
			hostname === hostnameFromSlug && pathname?.startsWith( `/${ subDirectoryPathFromSlug }` )
		);
	}
	// For standard non-subdirectory site, check that hostname matches the siteSlug.
	return hostname === siteSlug;
}
