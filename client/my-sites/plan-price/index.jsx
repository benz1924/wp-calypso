import { getCurrencyObject } from '@automattic/format-currency';
import classNames from 'classnames';
import { localize } from 'i18n-calypso';
import PropTypes from 'prop-types';
import { Component } from 'react';
import Badge from 'calypso/components/badge';

import './style.scss';

export class PlanPrice extends Component {
	render() {
		const {
			currencyCode,
			rawPrice,
			original,
			discounted,
			className,
			displayFlatPrice,
			displayPerMonthNotation,
			productDisplayPrice,
			isOnSale,
			taxText,
			translate,
		} = this.props;

		const classes = classNames( 'plan-price', className, {
			'is-original': original,
			'is-discounted': discounted,
		} );

		// productDisplayPrice is returned from Store Price and provides a geo-IDed currency format
		const shouldUseDisplayPrice = () => {
			if ( ! productDisplayPrice ) {
				return false;
			}
			if ( rawPrice ) {
				if ( Array.isArray( rawPrice ) && rawPrice.length > 1 ) {
					return false;
				}
			}
			return true;
		};

		if ( shouldUseDisplayPrice() ) {
			return (
				<h4 className={ classes }>
					<span
						className="plan-price__integer"
						// eslint-disable-next-line react/no-danger
						dangerouslySetInnerHTML={ { __html: productDisplayPrice } }
					/>
				</h4>
			);
		}

		if ( ! currencyCode || rawPrice === undefined ) {
			return null;
		}

		// "Normalize" the input price or price range.
		const rawPriceRange = Array.isArray( rawPrice ) ? rawPrice.slice( 0, 2 ) : [ rawPrice ];

		// If zero is in an array of length 2, render nothing
		if ( Array.isArray( rawPrice ) && rawPriceRange.includes( 0 ) ) {
			return null;
		}

		const priceRange = rawPriceRange.map( ( item ) => {
			return {
				price: getCurrencyObject( item, currencyCode ),
				raw: item,
			};
		} );

		const renderPrice = ( priceObj ) => {
			const fraction = priceObj.raw - priceObj.price.integer > 0 && priceObj.price.fraction;
			if ( fraction ) {
				return `${ priceObj.price.integer }${ fraction }`;
			}
			return priceObj.price.integer;
		};

		if ( displayFlatPrice ) {
			const smallerPrice = renderPrice( priceRange[ 0 ] );
			const higherPrice = priceRange[ 1 ] && renderPrice( priceRange[ 1 ] );

			return (
				<span className={ classes }>
					{ priceRange[ 0 ].price.symbol }
					{ ! higherPrice && renderPrice( priceRange[ 0 ] ) }
					{ higherPrice &&
						translate( '%(smallerPrice)s-%(higherPrice)s', {
							args: { smallerPrice, higherPrice },
							comment: 'The price range for a particular product',
						} ) }
				</span>
			);
		}

		const renderPriceHtml = ( priceObj ) => {
			return (
				<>
					<span className="plan-price__integer">{ priceObj.price.integer }</span>
					<sup className="plan-price__fraction">
						{ priceObj.raw - priceObj.price.integer > 0 && priceObj.price.fraction }
					</sup>
				</>
			);
		};

		const saleBadgeText = translate( 'Sale', {
			comment: 'Shown next to a domain that has a special discounted sale price',
		} );

		const smallerPriceHtml = renderPriceHtml( priceRange[ 0 ] );
		const higherPriceHtml = priceRange[ 1 ] && renderPriceHtml( priceRange[ 1 ] );

		return (
			<h4 className={ classes }>
				<sup className="plan-price__currency-symbol">{ priceRange[ 0 ].price.symbol }</sup>
				{ ! higherPriceHtml && renderPriceHtml( priceRange[ 0 ] ) }
				{ higherPriceHtml &&
					translate( '{{smallerPrice/}}-{{higherPrice/}}', {
						components: { smallerPrice: smallerPriceHtml, higherPrice: higherPriceHtml },
						comment: 'The price range for a particular product',
					} ) }
				{ taxText && (
					<sup className="plan-price__tax-amount">
						{ translate( '(+%(taxText)s tax)', { args: { taxText } } ) }
					</sup>
				) }
				{ displayPerMonthNotation && (
					<span className="plan-price__term">
						{ translate( 'per{{newline/}}month', {
							components: { newline: <br /> },
							comment:
								'Displays next to the price. You can remove the "{{newline/}}" if it is not proper for your language.',
						} ) }
					</span>
				) }
				{ isOnSale && <Badge>{ saleBadgeText }</Badge> }
			</h4>
		);
	}
}

export default localize( PlanPrice );

PlanPrice.propTypes = {
	rawPrice: PropTypes.oneOfType( [ PropTypes.number, PropTypes.arrayOf( PropTypes.number ) ] ),
	original: PropTypes.bool,
	discounted: PropTypes.bool,
	currencyCode: PropTypes.string,
	className: PropTypes.string,
	isOnSale: PropTypes.bool,
	taxText: PropTypes.string,
	translate: PropTypes.func.isRequired,
	displayPerMonthNotation: PropTypes.bool,
	currencyFormatOptions: PropTypes.object,
	productDisplayPrice: PropTypes.string,
};

PlanPrice.defaultProps = {
	currencyCode: 'USD',
	original: false,
	discounted: false,
	className: '',
	isOnSale: false,
	displayPerMonthNotation: false,
};
