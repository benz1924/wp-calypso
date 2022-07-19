import { WPCOM_DIFM_EXTRA_PAGE } from '@automattic/calypso-products';
import { Button } from '@automattic/components';
import formatCurrency from '@automattic/format-currency';
import { useShoppingCart } from '@automattic/shopping-cart';
import styled from '@emotion/styled';
import { useTranslate } from 'i18n-calypso';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import CalypsoShoppingCartProvider from 'calypso/my-sites/checkout/calypso-shopping-cart-provider';
import { BrowserView } from 'calypso/signup/difm/components/BrowserView';
import {
	HOME_PAGE,
	BLOG_PAGE,
	CONTACT_PAGE,
	ABOUT_PAGE,
	PHOTO_GALLERY_PAGE,
	VIDEO_GALLERY_PAGE,
	PORTFOLIO_PAGE,
	FAQ_PAGE,
	PROFILE_PAGE,
	SERVICES_PAGE,
	TESTIMONIALS_PAGE,
	MENU_PAGE,
} from 'calypso/signup/difm/constants';
import { useTranslatedPageTitles } from 'calypso/signup/difm/translation-hooks';
import StepWrapper from 'calypso/signup/step-wrapper';
import { getProductBySlug } from 'calypso/state/products-list/selectors';
import { saveSignupStep, submitSignupStep } from 'calypso/state/signup/progress/actions';
import { getSiteId } from 'calypso/state/sites/selectors';
import ShoppingCartForDIFM from './shopping-cart-for-difm';
import useCartForDIFM from './use-cart-for-difm';
import type { Dependencies } from 'calypso/signup/types';

import './style.scss';

const PageGrid = styled.div`
	display: grid;
	grid-template-columns: 1fr;
	row-gap: 20px;
	column-gap: 35px;
	margin: 0 0 30px;

	@media ( min-width: 960px ) and ( max-width: 1200px ) {
		grid-template-columns: 1fr 1fr;
		column-gap: 15px;
		row-gap: 25px;
	}

	@media ( min-width: 1200px ) {
		grid-template-columns: 1fr 1fr 1fr;
		row-gap: 40px;
		column-gap: 35px;
	}

	@media ( max-width: 600px ) {
		margin: 0 0 145px;
	}
`;

const GridCellContainer = styled.div`
	cursor: default;
	border-radius: 4px;
	position: relative;
	width: 100%;
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	font-weight: 500;
`;

const CellLabelContainer = styled.div`
	margin: 14px 0;
	text-align: left;
	display: flex;
	justify-content: center;
	align-items: center;
	font-size: 14px;
	gap: 8px;

	width: 100%;
	@media ( min-width: 960px ) {
		justify-content: left;
	}
`;

const PageCellBadge = styled.div`
	background: var( --studio-green-5 );
	border-radius: 4px;
	text-align: center;
	font-size: 12px;
	padding: 0;
	line-height: 20px;
	font-weight: 500;
	color: var( --studio-green-80 );
	height: 20px;
	width: 61px;
`;

interface PageCellType {
	pageId: string;
	selectedPages: string[];
	onClick: ( pageId: string ) => void;
	popular?: boolean;
	required?: boolean;
}

function PageCell( { pageId, popular, required, selectedPages, onClick }: PageCellType ) {
	const translate = useTranslate();
	const selectedIndex = selectedPages.indexOf( pageId );
	const isSelected = Boolean( selectedIndex > -1 );
	const title = useTranslatedPageTitles()[ pageId ];

	return (
		<GridCellContainer>
			<BrowserView
				onClick={ () => onClick( pageId ) }
				pageId={ pageId }
				isSelected={ isSelected }
				selectedIndex={ selectedIndex >= 0 ? selectedIndex : -1 }
			/>
			<CellLabelContainer>
				<div>{ title }</div>
				{ popular ? <PageCellBadge>{ translate( 'Popular' ) }</PageCellBadge> : null }
				{ required ? <PageCellBadge>{ translate( 'Required' ) }</PageCellBadge> : null }
			</CellLabelContainer>
		</GridCellContainer>
	);
}

function PageSelector( {
	selectedPages,
	setSelectedPages,
}: {
	selectedPages: string[];
	setSelectedPages: ( pages: string[] ) => void;
} ) {
	const onPageClick = ( pageId: string ) => {
		const foundIndex = selectedPages.indexOf( pageId );
		// The home page cannot be touched
		if ( pageId !== HOME_PAGE ) {
			if ( foundIndex > -1 ) {
				setSelectedPages( selectedPages.filter( ( page, index ) => index !== foundIndex ) );
			} else {
				setSelectedPages( [ ...selectedPages, pageId ] );
			}
		}
	};

	return (
		<PageGrid>
			<PageCell
				required
				pageId={ HOME_PAGE }
				selectedPages={ selectedPages }
				onClick={ onPageClick }
			/>
			<PageCell
				popular
				pageId={ ABOUT_PAGE }
				selectedPages={ selectedPages }
				onClick={ onPageClick }
			/>
			<PageCell
				popular
				pageId={ CONTACT_PAGE }
				selectedPages={ selectedPages }
				onClick={ onPageClick }
			/>

			<PageCell
				popular
				pageId={ BLOG_PAGE }
				selectedPages={ selectedPages }
				onClick={ onPageClick }
			/>

			<PageCell
				pageId={ PHOTO_GALLERY_PAGE }
				selectedPages={ selectedPages }
				onClick={ onPageClick }
			/>
			<PageCell pageId={ SERVICES_PAGE } selectedPages={ selectedPages } onClick={ onPageClick } />
			<PageCell
				pageId={ VIDEO_GALLERY_PAGE }
				selectedPages={ selectedPages }
				onClick={ onPageClick }
			/>
			<PageCell pageId={ MENU_PAGE } selectedPages={ selectedPages } onClick={ onPageClick } />
			<PageCell pageId={ PORTFOLIO_PAGE } selectedPages={ selectedPages } onClick={ onPageClick } />
			<PageCell pageId={ FAQ_PAGE } selectedPages={ selectedPages } onClick={ onPageClick } />
			<PageCell
				pageId={ TESTIMONIALS_PAGE }
				selectedPages={ selectedPages }
				onClick={ onPageClick }
			/>
			<PageCell pageId={ PROFILE_PAGE } selectedPages={ selectedPages } onClick={ onPageClick } />
		</PageGrid>
	);
}

interface StepProps {
	stepSectionName: string | null;
	stepName: string;
	goToStep: () => void;
	goToNextStep: () => void;
	signupDependencies: Dependencies;
}

const StyledButton = styled( Button )`
	&.button.is-primary {
		padding: 10px 27px 10px 28px;
	}
`;

const Placeholder = styled.div`
	animation: pulse-light 2s ease-in-out infinite;
	background-color: var( --color-neutral-10 );
	color: transparent;
	min-height: 16px;
	display: inline-block;
	min-width: 32px;
`;

function DIFMPagePicker( props: StepProps ) {
	const {
		stepName,
		goToNextStep,
		signupDependencies: { siteId, siteSlug, newOrExistingSiteChoice },
	} = props;
	const translate = useTranslate();
	const dispatch = useDispatch();
	const [ isCheckoutPressed, setIsCheckoutPressed ] = useState( false );
	const [ selectedPages, setSelectedPages ] = useState< string[] >( [
		HOME_PAGE,
		ABOUT_PAGE,
		CONTACT_PAGE,
	] );
	const cartKey = useSelector( ( state ) => getSiteId( state, siteSlug ?? siteId ) );

	const extraPageProduct = useSelector( ( state ) =>
		getProductBySlug( state, WPCOM_DIFM_EXTRA_PAGE )
	);
	const { replaceProductsInCart } = useShoppingCart( cartKey ?? undefined );
	const {
		items,
		isCartLoading,
		isCartPendingUpdate,
		isCartUpdateStarted,
		isProductsLoading,
		effectiveCurrencyCode: currencyCode,
	} = useCartForDIFM( selectedPages );

	useEffect( () => {
		dispatch( saveSignupStep( { stepName } ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	const submitPickedPages = async () => {
		if ( ! isCheckoutPressed ) {
			setIsCheckoutPressed( true );
			if ( cartKey ) {
				//Empty cart so that the sign up flow can add products to the cart
				await replaceProductsInCart( [] );
			}
			dispatch( submitSignupStep( { stepName }, { selectedPageTitles: selectedPages } ) );
			goToNextStep();
		}
	};

	const headerText = translate( 'Add pages to your {{wbr}}{{/wbr}}website', {
		components: { wbr: <wbr /> },
	} );
	const subHeaderText = translate(
		'Select your desired pages by clicking the thumbnails. {{br}}{{/br}}Your site build includes up to %(freePageCount)s pages, add additional pages for {{PriceWrapper}}%(extraPagePrice)s{{/PriceWrapper}} each.',
		{
			components: {
				br: <br />,
				PriceWrapper:
					! currencyCode || isProductsLoading || isCartLoading ? <Placeholder /> : <span />,
			},
			args: {
				freePageCount: 5,
				extraPagePrice:
					extraPageProduct && currencyCode
						? formatCurrency( extraPageProduct.cost, currencyCode, { precision: 0 } )
						: ' ',
			},
		}
	);

	const isExistingSite = newOrExistingSiteChoice === 'existing-site';
	const isInitialBasketLoaded = items.length > 0;

	return (
		<StepWrapper
			headerText={ headerText }
			fallbackHeaderText={ headerText }
			subHeaderText={ subHeaderText }
			fallbackSubHeaderText={ subHeaderText }
			stepContent={
				<PageSelector selectedPages={ selectedPages } setSelectedPages={ setSelectedPages } />
			}
			hideSkip
			align="left"
			isHorizontalLayout={ true }
			isWideLayout={ false }
			headerButton={
				<StyledButton
					disabled={ ! isInitialBasketLoaded }
					busy={
						( isExistingSite &&
							( isProductsLoading ||
								isCartPendingUpdate ||
								isCartLoading ||
								isCartUpdateStarted ) ) ||
						isCheckoutPressed
					}
					primary
					onClick={ submitPickedPages }
				>
					{ translate( 'Go to Checkout' ) }
				</StyledButton>
			}
			headerContent={ <ShoppingCartForDIFM selectedPages={ selectedPages } /> }
			{ ...props }
		/>
	);
}

export default function ShoppingCartWrappedPagePicker( props: StepProps ) {
	return (
		<CalypsoShoppingCartProvider>
			<DIFMPagePicker { ...props } />
		</CalypsoShoppingCartProvider>
	);
}
