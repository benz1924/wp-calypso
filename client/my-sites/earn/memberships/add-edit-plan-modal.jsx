import { Dialog, FormInputValidation } from '@automattic/components';
import formatCurrency from '@automattic/format-currency';
import { ToggleControl } from '@wordpress/components';
import classnames from 'classnames';
import { useTranslate } from 'i18n-calypso';
import { useState } from 'react';
import { connect } from 'react-redux';
import CountedTextArea from 'calypso/components/forms/counted-textarea';
import FormCurrencyInput from 'calypso/components/forms/form-currency-input';
import FormFieldset from 'calypso/components/forms/form-fieldset';
import FormLabel from 'calypso/components/forms/form-label';
import FormSectionHeading from 'calypso/components/forms/form-section-heading';
import FormSelect from 'calypso/components/forms/form-select';
import FormTextInput from 'calypso/components/forms/form-text-input';
import InlineSupportLink from 'calypso/components/inline-support-link';
import Notice from 'calypso/components/notice';
import SectionNav from 'calypso/components/section-nav';
import SectionNavTabItem from 'calypso/components/section-nav/item';
import SectionNavTabs from 'calypso/components/section-nav/tabs';
import {
	requestAddProduct,
	requestUpdateProduct,
} from 'calypso/state/memberships/product-list/actions';
import { getSelectedSiteId } from 'calypso/state/ui/selectors';

/**
 * @typedef {[string, number] CurrencyMinimum
 *
 *
 * Stripe Currencies also supported by WordPress.com with minimum transaction amounts.
 *
 * https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts
 * @type { [currency: string]: number }
 */
const MINIMUM_CURRENCY_AMOUNT = {
	USD: 0.5,
	AUD: 0.5,
	BRL: 0.5,
	CAD: 0.5,
	CHF: 0.5,
	DKK: 2.5,
	EUR: 0.5,
	GBP: 0.3,
	HKD: 4.0,
	INR: 0.5,
	JPY: 50,
	MXN: 10,
	NOK: 3.0,
	NZD: 0.5,
	PLN: 2.0,
	SEK: 3.0,
	SGD: 0.5,
};

/**
 * @type Array<{ code: string }>
 */
const currencyList = Object.keys( MINIMUM_CURRENCY_AMOUNT ).map( ( code ) => ( { code } ) );

/**
 * Return the minimum transaction amount for a currency.
 *
 *
 * @param {string} currency - Currency.
 * @returns {number} Minimum transaction amount for given currency.
 */
function minimumCurrencyTransactionAmount( currency ) {
	return MINIMUM_CURRENCY_AMOUNT[ currency ];
}

/**
 * @type {number}
 */
const MAX_LENGTH_CUSTOM_CONFIRMATION_EMAIL_MESSAGE = 2000;

/**
 * Identifier for the General tab.
 *
 * @type {string}
 */
const TAB_GENERAL = 'general';

/**
 * Identifier for the Email tab.
 *
 * @type {string}
 */
const TAB_EMAIL = 'email';

/**
 * List of tab identifiers.
 *
 * @type {string[]}
 */
const TABS = [ TAB_GENERAL, TAB_EMAIL ];

const RecurringPaymentsPlanAddEditModal = ( {
	addProduct,
	closeDialog,
	product,
	siteId,
	updateProduct,
} ) => {
	const translate = useTranslate();
	const [ currentDialogTab, setCurrentDialogTab ] = useState( TAB_GENERAL );
	const [ editedCustomConfirmationMessage, setEditedCustomConfirmationMessage ] = useState(
		product?.welcome_email_content ?? ''
	);
	const [ editedMultiplePerUser, setEditedMultiplePerUser ] = useState(
		product?.multiple_per_user ?? false
	);

	const [ editedMarkAsDonation, setEditedMarkAsDonation ] = useState( product?.type ?? null );

	const [ editedPayWhatYouWant, setEditedPayWhatYouWant ] = useState(
		product?.buyer_can_change_amount ?? false
	);
	const [ editedPrice, setEditedPrice ] = useState( {
		currency: product?.currency ?? 'USD',
		value: product?.price ?? minimumCurrencyTransactionAmount( 'USD' ),
	} );
	const [ editedProductName, setEditedProductName ] = useState( product?.title ?? '' );
	const [ editedPostsEmail, setEditedPostsEmail ] = useState(
		product?.subscribe_as_site_subscriber ?? false
	);
	const [ editedSchedule, setEditedSchedule ] = useState( product?.renewal_schedule ?? '1 month' );
	const [ focusedName, setFocusedName ] = useState( false );

	const getTabName = ( tab ) => {
		switch ( tab ) {
			case TAB_GENERAL:
				return translate( 'General' );
			case TAB_EMAIL:
				return translate( 'Email' );
		}
	};

	const isValidCurrencyAmount = ( currency, price ) =>
		price >= minimumCurrencyTransactionAmount( currency );

	const isFormValid = ( field ) => {
		if (
			( field === 'price' || ! field ) &&
			! isValidCurrencyAmount( editedPrice.currency, editedPrice.value )
		) {
			return false;
		}
		if ( ( field === 'name' || ! field ) && editedProductName.length === 0 ) {
			return false;
		}
		if (
			! field &&
			editedCustomConfirmationMessage &&
			editedCustomConfirmationMessage.length > MAX_LENGTH_CUSTOM_CONFIRMATION_EMAIL_MESSAGE
		) {
			return false;
		}
		return true;
	};

	const handleCurrencyChange = ( event ) => {
		const { value: currency } = event.currentTarget;
		setEditedPrice( { ...editedPrice, currency } );
	};
	const handlePriceChange = ( event ) => {
		const value = parseFloat( event.currentTarget.value );
		setEditedPrice( { ...editedPrice, value } );
	};
	const handlePayWhatYouWant = ( newValue ) => setEditedPayWhatYouWant( newValue );
	const handleMultiplePerUser = ( newValue ) => setEditedMultiplePerUser( newValue );
	const handleMarkAsDonation = ( newValue ) =>
		setEditedMarkAsDonation( true === newValue ? 'donation' : null );
	const onNameChange = ( event ) => setEditedProductName( event.target.value );
	const onSelectSchedule = ( event ) => setEditedSchedule( event.target.value );

	const onClose = ( reason ) => {
		if ( reason === 'submit' && ! product ) {
			addProduct(
				siteId,
				{
					currency: editedPrice.currency,
					price: editedPrice.value,
					title: editedProductName,
					interval: editedSchedule,
					buyer_can_change_amount: editedPayWhatYouWant,
					multiple_per_user: editedMultiplePerUser,
					welcome_email_content: editedCustomConfirmationMessage,
					subscribe_as_site_subscriber: editedPostsEmail,
					type: editedMarkAsDonation,
					is_editable: true,
				},
				translate( 'Added "%s" payment plan.', { args: editedProductName } )
			);
		} else if ( reason === 'submit' && product ) {
			updateProduct(
				siteId,
				{
					ID: product.ID,
					currency: editedPrice.currency,
					price: editedPrice.value,
					title: editedProductName,
					interval: editedSchedule,
					buyer_can_change_amount: editedPayWhatYouWant,
					multiple_per_user: editedMultiplePerUser,
					welcome_email_content: editedCustomConfirmationMessage,
					subscribe_as_site_subscriber: editedPostsEmail,
					type: editedMarkAsDonation,
					is_editable: true,
				},
				translate( 'Updated "%s" payment plan.', { args: editedProductName } )
			);
		}
		closeDialog();
	};

	const renderGeneralTab = () => {
		const editProduct = translate( 'Edit your existing payment plan.' );
		const noProduct = translate(
			'Each amount you add will create a separate payment plan. You can create many of them.'
		);
		return (
			<>
				<p>{ product ? editProduct : noProduct }</p>
				<FormFieldset>
					<FormLabel htmlFor="currency">{ translate( 'Select price' ) }</FormLabel>
					{ product && (
						<Notice
							text={ translate(
								'Updating the price will not affect existing subscribers, who will pay what they were originally charged on renewal.'
							) }
							showDismiss={ false }
						/>
					) }
					<FormCurrencyInput
						name="currency"
						id="currency"
						value={ isNaN( editedPrice.value ) ? '' : editedPrice.value }
						onChange={ handlePriceChange }
						currencySymbolPrefix={ editedPrice.currency }
						onCurrencyChange={ handleCurrencyChange }
						currencyList={ currencyList }
						placeholder="0.00"
					/>
					{ ! isFormValid( 'price' ) && (
						<FormInputValidation
							isError
							text={ translate( 'Please enter a price higher than %s', {
								args: [
									formatCurrency(
										minimumCurrencyTransactionAmount( editedPrice.currency ),
										editedPrice.currency
									),
								],
							} ) }
						/>
					) }
				</FormFieldset>
				<FormFieldset>
					<FormLabel htmlFor="renewal_schedule">
						{ translate( 'Select renewal frequency' ) }
					</FormLabel>
					<FormSelect id="renewal_schedule" value={ editedSchedule } onChange={ onSelectSchedule }>
						<option value="1 month">{ translate( 'Renew monthly' ) }</option>
						<option value="1 year">{ translate( 'Renew yearly' ) }</option>
						<option value="one-time">{ translate( 'One time sale' ) }</option>
					</FormSelect>
				</FormFieldset>
				<FormFieldset>
					<FormLabel htmlFor="title">
						{ translate( 'Please describe your payment plan' ) }
					</FormLabel>
					<FormTextInput
						id="title"
						value={ editedProductName }
						onChange={ onNameChange }
						onBlur={ () => setFocusedName( true ) }
					/>
					{ ! isFormValid( 'name' ) && focusedName && (
						<FormInputValidation isError text={ translate( 'Please input a name.' ) } />
					) }
				</FormFieldset>
				<FormFieldset>
					<ToggleControl
						onChange={ handlePayWhatYouWant }
						checked={ editedPayWhatYouWant }
						label={ translate(
							'Enable customers to pick their own amount ("Pay what you want").'
						) }
					/>
				</FormFieldset>
				<FormFieldset>
					<ToggleControl
						onChange={ handleMultiplePerUser }
						checked={ editedMultiplePerUser }
						label={ translate(
							'Allow the same customer to purchase or sign up to this plan multiple times.'
						) }
					/>
				</FormFieldset>
				<FormFieldset>
					<ToggleControl
						onChange={ handleMarkAsDonation }
						checked={ 'donation' === editedMarkAsDonation }
						label={ translate( 'Mark this plan as a donation.' ) }
						disabled={ !! product }
					/>
				</FormFieldset>
			</>
		);
	};

	const renderEmailTab = () => {
		return (
			<>
				<FormFieldset>
					<h6 className="memberships__dialog-form-header">{ translate( 'Posts via email' ) }</h6>
					<p>
						{ translate(
							'Allow members of this payment plan to opt into receiving new posts via email.'
						) }{ ' ' }
						<InlineSupportLink supportContext="paid-newsletters" showIcon={ false }>
							{ translate( 'Learn more.' ) }
						</InlineSupportLink>
					</p>
					<ToggleControl
						onChange={ ( newValue ) => setEditedPostsEmail( newValue ) }
						checked={ editedPostsEmail }
						label={ translate( 'Email newly published posts to your customers.' ) }
					/>
				</FormFieldset>
				<FormFieldset>
					<h6 className="memberships__dialog-form-header">
						{ translate( 'Custom confirmation message' ) }
					</h6>
					<p>
						{ translate(
							'Add a custom message to the confirmation email that is sent after purchase. For example, you can thank your customers.'
						) }
					</p>
					<CountedTextArea
						value={ editedCustomConfirmationMessage }
						onChange={ ( event ) => setEditedCustomConfirmationMessage( event.target.value ) }
						acceptableLength={ MAX_LENGTH_CUSTOM_CONFIRMATION_EMAIL_MESSAGE }
						showRemainingCharacters={ true }
						placeholder={ translate( 'Thank you for subscribing!' ) }
					/>
				</FormFieldset>
			</>
		);
	};

	const editPlan = translate( 'Edit a payment plan' );
	const addPlan = translate( 'Add a new payment plan' );
	return (
		<Dialog
			isVisible={ true }
			onClose={ onClose }
			buttons={ [
				{
					label: translate( 'Cancel' ),
					action: 'cancel',
				},
				{
					label: translate( 'Save' ),
					action: 'submit',
					disabled: ! isFormValid(),
					isPrimary: true,
				},
			] }
		>
			<FormSectionHeading>{ product ? editPlan : addPlan }</FormSectionHeading>
			<SectionNav
				className="memberships__dialog-nav"
				selectedText={ getTabName( currentDialogTab ) }
			>
				<SectionNavTabs>
					{ TABS.map( ( tab ) => (
						<SectionNavTabItem
							key={ tab }
							selected={ currentDialogTab === tab }
							onClick={ () => setCurrentDialogTab( tab ) }
						>
							{ getTabName( tab ) }
						</SectionNavTabItem>
					) ) }
				</SectionNavTabs>
			</SectionNav>
			<div className="memberships__dialog-sections">
				<div
					className={ classnames( 'memberships__dialog-section', {
						'is-visible': currentDialogTab === TAB_GENERAL,
					} ) }
				>
					{ renderGeneralTab() }
				</div>
				<div
					className={ classnames( 'memberships__dialog-section', {
						'is-visible': currentDialogTab === TAB_EMAIL,
					} ) }
				>
					{ renderEmailTab() }
				</div>
			</div>
		</Dialog>
	);
};

export default connect(
	( state ) => ( {
		siteId: getSelectedSiteId( state ),
	} ),
	{ addProduct: requestAddProduct, updateProduct: requestUpdateProduct }
)( RecurringPaymentsPlanAddEditModal );
