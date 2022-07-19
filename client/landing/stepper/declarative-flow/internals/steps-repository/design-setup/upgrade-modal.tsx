import { Button, Gridicon, Dialog, ScreenReaderText } from '@automattic/components';
import { useSelect } from '@wordpress/data';
import { useTranslate } from 'i18n-calypso';
import { useThemeDetails } from 'calypso/landing/stepper/hooks/use-theme-details';
import { PRODUCTS_LIST_STORE } from 'calypso/landing/stepper/stores';
import ThemeFeatures from './theme-features';
import './upgrade-modal.scss';

interface UpgradeModalProps {
	/* Theme slug */
	slug: string;
	isOpen: boolean;
	closeModal: () => void;
	checkout: () => void;
}

const UpgradeModal = ( { slug, isOpen, closeModal, checkout }: UpgradeModalProps ) => {
	const translate = useTranslate();
	const theme = useThemeDetails( slug );
	const features = theme.data && theme.data.taxonomies.features;
	const featuresHeading = translate( 'Theme features' ) as string;
	const themeProduct = useSelect( ( select ) =>
		select( PRODUCTS_LIST_STORE ).getProductBySlug( 'premium-theme' )
	);
	const themePrice = themeProduct?.combined_cost_display;

	return (
		<Dialog
			className="upgrade-modal"
			isVisible={ isOpen }
			onClose={ () => closeModal() }
			isFullScreen
		>
			<div className="upgrade-modal__col">
				<h1 className="upgrade-modal__heading">{ translate( 'Unlock this premium theme' ) }</h1>
				<p>
					{ translate(
						'You can purchase a subscription to use this theme or join the Premium plan to get it for free.'
					) }
				</p>
				<div className="upgrade-modal__actions">
					<Button className="upgrade-modal__cancel" onClick={ () => closeModal() }>
						{ translate( 'Cancel' ) }
					</Button>
					<Button className="upgrade-modal__upgrade" primary onClick={ () => checkout() }>
						{ translate( 'Buy and activate theme' ) }
					</Button>
				</div>
			</div>
			<div className="upgrade-modal__col">
				<div className="upgrade-modal__included">
					<h2>{ translate( 'Included with your purchase' ) }</h2>
					<ul>
						<li className="upgrade-modal__included-item">
							<Gridicon icon="checkmark" size={ 16 } />
							{ translate( 'Best-in-class hosting' ) }
						</li>
						<li className="upgrade-modal__included-item">
							<Gridicon icon="checkmark" size={ 16 } />
							{ translate( 'Dozens of free themes' ) }
						</li>
						<li className="upgrade-modal__included-item">
							<Gridicon icon="checkmark" size={ 16 } />
							{ translate( 'Unlimited customer support via email' ) }
						</li>
					</ul>
				</div>
				{ features && <ThemeFeatures features={ features } heading={ featuresHeading } /> }
			</div>
			<Button className="upgrade-modal__close" borderless onClick={ () => closeModal() }>
				<Gridicon icon="cross" size={ 12 } />
				<ScreenReaderText>{ translate( 'Close modal' ) }</ScreenReaderText>
			</Button>
		</Dialog>
	);
};

export default UpgradeModal;
