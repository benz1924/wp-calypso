import { PaymentLogo } from '@automattic/composite-checkout';
import { useSelect } from '@wordpress/data';
import { useI18n } from '@wordpress/react-i18n';
import { Fragment } from 'react';
import {
	VisaLogo,
	MastercardLogo,
	AmexLogo,
} from 'calypso/my-sites/checkout/composite-checkout/components/payment-logos';
import { PaymentMethodLogos } from 'calypso/my-sites/checkout/composite-checkout/components/payment-method-logos';
import {
	SummaryLine,
	SummaryDetails,
} from 'calypso/my-sites/checkout/composite-checkout/components/summary-details';
import CreditCardFields from './credit-card-fields';
import CreditCardPayButton from './credit-card-pay-button';
import type { CardStoreType } from './types';

export { createCreditCardPaymentMethodStore } from './store';

export function createCreditCardMethod( {
	store,
	shouldUseEbanx,
	shouldShowTaxFields,
	activePayButtonText,
	allowUseForAllSubscriptions,
}: {
	store: CardStoreType;
	shouldUseEbanx?: boolean;
	shouldShowTaxFields?: boolean;
	activePayButtonText?: string;
	allowUseForAllSubscriptions?: boolean;
} ) {
	return {
		id: 'card',
		paymentProcessorId: 'card',
		label: <CreditCardLabel />,
		activeContent: (
			<CreditCardFields
				shouldUseEbanx={ shouldUseEbanx }
				shouldShowTaxFields={ shouldShowTaxFields }
				allowUseForAllSubscriptions={ allowUseForAllSubscriptions }
			/>
		),
		submitButton: (
			<CreditCardPayButton
				store={ store }
				shouldUseEbanx={ shouldUseEbanx }
				activeButtonText={ activePayButtonText }
			/>
		),
		inactiveContent: <CreditCardSummary />,
		getAriaLabel: ( __: ( text: string ) => string ) => __( 'Credit Card' ),
	};
}

function CreditCardSummary() {
	const fields = useSelect( ( select ) => select( 'wpcom-credit-card' ).getFields() );
	const cardholderName = fields.cardholderName;
	const brand = useSelect( ( select ) => select( 'wpcom-credit-card' ).getBrand() );

	return (
		<SummaryDetails>
			<SummaryLine>{ cardholderName?.value }</SummaryLine>
			<SummaryLine>
				{ brand !== 'unknown' && '****' } <PaymentLogo brand={ brand } isSummary={ true } />
			</SummaryLine>
		</SummaryDetails>
	);
}

function CreditCardLabel() {
	const { __ } = useI18n();
	return (
		<Fragment>
			<span>{ __( 'Credit or debit card' ) }</span>
			<CreditCardLogos />
		</Fragment>
	);
}

function CreditCardLogos() {
	return (
		<PaymentMethodLogos className="credit-card__logo payment-logos">
			<VisaLogo />
			<MastercardLogo />
			<AmexLogo />
		</PaymentMethodLogos>
	);
}
