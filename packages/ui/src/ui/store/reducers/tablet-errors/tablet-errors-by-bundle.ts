import {PayloadAction, createSlice} from '@reduxjs/toolkit';
import {YTError} from '../../../types';
import {TabletErrorsApi} from '../../../../shared/tablet-errors-manager';
import {mergeStateOnClusterChange} from '../utils';

export type TabletErrorsByBundleState = {
    loading: boolean;
    loaded: boolean;
    error: YTError | undefined;

    bundle: string;
    data: TabletErrorsApi['tablet_errors_by_bundle']['response'] | undefined;
};

const initialState: TabletErrorsByBundleState = {
    loading: false,
    loaded: false,
    error: undefined,
    bundle: '',
    data: undefined,
};

const tabletErrorsByBundleSlice = createSlice({
    name: 'tabletErrors.tabletErrorsByBundle',
    initialState,
    reducers: {
        onRequest(
            state,
            {payload: {bundle}}: PayloadAction<Pick<TabletErrorsByBundleState, 'bundle'>>,
        ) {
            state.loading = true;
            if (bundle != state.bundle) {
                Object.assign(state, {bundle, data: undefined});
            }
        },
        onSuccess(
            state,
            {payload: {data}}: PayloadAction<Pick<TabletErrorsByBundleState, 'data'>>,
        ) {
            Object.assign(state, {data, loading: false, loaded: true, error: undefined});
        },
        onError(
            state,
            {payload: {error}}: PayloadAction<Pick<TabletErrorsByBundleState, 'error'>>,
        ) {
            Object.assign(state, {error, loading: false});
        },
    },
});

export const tabletErrorsByBundleActions = tabletErrorsByBundleSlice.actions;
export const tabletErrorsByBundle = mergeStateOnClusterChange(
    {},
    initialState,
    tabletErrorsByBundleSlice.reducer,
);
