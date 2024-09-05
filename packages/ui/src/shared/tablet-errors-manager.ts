import {YTError} from '../ytsaurus-ui.ui/types';

export const TABLET_ERRORS_MANAGER_POST_ACTIONS = new Set([
    'tablet_errors_by_bundle',
    'tablet_errors_by_table_and_method',
    'tablet_errors_by_table_and_timestamp',
] as const);

export type TabletErrorsManagerPostActionType = Parameters<
    (typeof TABLET_ERRORS_MANAGER_POST_ACTIONS)['add']
>[0];

export type MethodCount = {
    method: string;
    count: number;
};

export type TableMethodErrorsCount = {
    table_id: string;
    methods: Array<MethodCount>;
};

export type TabletErrorsBaseParams = {
    cluster: string;
    start_timestamp: number;
    end_timestamp: number;
    methods?: Array<string>;
    count_limit: number;
};

export type TabletMethodError = {
    tablet_id: string;
    timestamp: number;
    method: string;
    error: YTError;
};

export type MethodErrors = {
    method: string;
    errors: Array<TabletError>;
};

export type TabletError = {
    tablet_id: string;
    timestamp: number;
    error: YTError;
};

export type TabletErrorsApi = {
    tablet_errors_by_bundle: {
        body: TabletErrorsBaseParams & {tablet_cell_bundle: string};
        response: {
            error: Array<TableMethodErrorsCount>;
        };
    };
    tablet_errors_by_table_and_method: {
        body: TabletErrorsBaseParams & {table_id: string};
        response: Array<MethodErrors>;
    };
    tablet_errors_by_table_and_timestamp: {
        body: TabletErrorsBaseParams & {table_id: string};
        response: Array<TabletMethodError>;
    };
};
