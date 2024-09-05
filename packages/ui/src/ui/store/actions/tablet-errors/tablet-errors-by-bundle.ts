import {ThunkAction} from 'redux-thunk';
import {RootState} from '../../../store/reducers';
import axios, {AxiosResponse} from 'axios';
import {TabletErrorsApi} from '../../../../shared/tablet-errors-manager';
import {getCluster} from '../../../store/selectors/global';
import {tabletErrorsByBundleActions} from '../../../store/reducers/tablet-errors/tablet-errors-by-bundle';

type AsyncAction<T = void> = ThunkAction<Promise<T>, RootState, unknown, any>;

export function loadTabletErrorsByBundle(
    params: Pick<
        TabletErrorsApi['tablet_errors_by_bundle']['body'],
        'tablet_cell_bundle' | 'start_timestamp' | 'end_timestamp'
    >,
): AsyncAction {
    return (dispatch, getState) => {
        dispatch(tabletErrorsByBundleActions.onRequest({bundle: params.tablet_cell_bundle}));

        const state = getState();
        const cluster = getCluster(state);

        return axios
            .post<
                TabletErrorsApi['tablet_errors_by_bundle']['response'],
                AxiosResponse<TabletErrorsApi['tablet_errors_by_bundle']['response']>,
                TabletErrorsApi['tablet_errors_by_bundle']['body']
            >(`/api/tablet-errors/${cluster}/tablet_errors_by_bundle`, {...params, cluster, count_limit: 100})
            .then(({data}) => {
                dispatch(tabletErrorsByBundleActions.onSuccess({data}));
            });
    };
}
