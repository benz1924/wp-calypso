import { Card } from '@automattic/components';
import classNames from 'classnames';
import { includes } from 'lodash';
import PropTypes from 'prop-types';
import { PureComponent } from 'react';
import { connect } from 'react-redux';
import { recordTracksEvent } from 'calypso/state/analytics/actions';
import { startImport } from 'calypso/state/imports/actions';
import { appStates } from 'calypso/state/imports/constants';
import ErrorPane from './error-pane';
import ImporterHeader from './importer-header';
import ImportingPane from './importing-pane';
import UploadingPane from './uploading-pane';

import './file-importer.scss';

/**
 * Module variables
 */
const compactStates = [ appStates.DISABLED, appStates.INACTIVE ];
const importingStates = [
	appStates.IMPORT_FAILURE,
	appStates.IMPORT_SUCCESS,
	appStates.IMPORTING,
	appStates.MAP_AUTHORS,
];
const uploadingStates = [
	appStates.UPLOAD_PROCESSING,
	appStates.READY_FOR_UPLOAD,
	appStates.UPLOAD_FAILURE,
	appStates.UPLOAD_SUCCESS,
	appStates.UPLOADING,
];

class FileImporter extends PureComponent {
	static propTypes = {
		importerData: PropTypes.shape( {
			title: PropTypes.string.isRequired,
			icon: PropTypes.string.isRequired,
			description: PropTypes.node.isRequired,
			uploadDescription: PropTypes.node,
		} ).isRequired,
		importerStatus: PropTypes.shape( {
			errorData: PropTypes.shape( {
				type: PropTypes.string.isRequired,
				description: PropTypes.string.isRequired,
			} ),
			importerState: PropTypes.string.isRequired,
			statusMessage: PropTypes.string,
			type: PropTypes.string.isRequired,
		} ),
		site: PropTypes.shape( {
			ID: PropTypes.number.isRequired,
		} ),
	};

	handleClick = ( shouldStartImport ) => {
		const {
			importerStatus: { type },
			site: { ID: siteId },
		} = this.props;

		if ( shouldStartImport ) {
			this.props.startImport( siteId, type );
		}

		this.props.recordTracksEvent( 'calypso_importer_main_start_clicked', {
			blog_id: siteId,
			importer_id: type,
		} );
	};

	render() {
		const { title, icon, description, overrideDestination, uploadDescription, optionalUrl } =
			this.props.importerData;
		const { importerStatus, site } = this.props;
		const { errorData, importerState } = importerStatus;
		const isEnabled = appStates.DISABLED !== importerState;
		const showStart = includes( compactStates, importerState );
		const cardClasses = classNames( 'importer__file-importer-card', {
			'is-compact': showStart,
			'is-disabled': ! isEnabled,
		} );
		const cardProps = {
			displayAsLink: true,
			onClick: this.handleClick.bind( this, true ),
			tagName: 'button',
		};

		if ( overrideDestination ) {
			/**
			 * Override where the user lands when they click the importer.
			 *
			 * This is used for the new Migration logic for the moment.
			 */
			cardProps.href = overrideDestination.replace( '%SITE_SLUG%', site.slug );
			cardProps.onClick = this.handleClick.bind( this, false );
		}

		return (
			<Card className={ cardClasses } { ...( showStart ? cardProps : undefined ) }>
				<ImporterHeader
					importerStatus={ importerStatus }
					icon={ icon }
					title={ title }
					description={ description }
				/>
				{ errorData && <ErrorPane type={ errorData.type } description={ errorData.description } /> }
				{ includes( importingStates, importerState ) && (
					<ImportingPane importerStatus={ importerStatus } sourceType={ title } site={ site } />
				) }
				{ includes( uploadingStates, importerState ) && (
					<UploadingPane
						isEnabled={ isEnabled }
						description={ uploadDescription }
						importerStatus={ importerStatus }
						site={ site }
						optionalUrl={ optionalUrl }
					/>
				) }
			</Card>
		);
	}
}

export default connect( null, { recordTracksEvent, startImport } )( FileImporter );
