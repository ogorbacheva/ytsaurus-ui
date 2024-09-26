import _ from 'lodash';
import ypath from '../../../common/thor/ypath';
import {Toaster} from '@gravity-ui/uikit';

import createActionTypes from '../../../constants/utils';
import {isRetryFutile} from '../../../utils';
import {getBatchError, showErrorPopup} from '../../../utils/utils';

import {YTErrors} from '../../../rum/constants';
import {YTApiId, ytApiV3Id} from '../../../rum/rum-wrap-api';
import {USE_SUPRESS_SYNC} from '../../../../shared/constants';
import type {AxiosError} from 'axios';
import type {Dispatch} from 'redux';
import type {BatchSubRequest} from '../../../../shared/yt-types';
import type {
    MasterAlert,
    MasterDataItemInfo,
    MastersConfigResponse,
    ResponseItemsGroup,
} from '../../reducers/system/masters';
import {uiSettings} from '../../../config/ui-settings';

export const FETCH_MASTER_CONFIG = createActionTypes('MASTER_CONFIG');
export const FETCH_MASTER_DATA = createActionTypes('MASTER_DATA');
export const SET_MASTER_ALERTS = 'SET_MASTER_ALERTS';

const toaster = new Toaster();

const {NODE_DOES_NOT_EXIST} = YTErrors;

const executeBatchWithTimeout: (typeof ytApiV3Id)['executeBatch'] = (id, data) => {
    const {systemPageBatchTimeoutMs} = uiSettings;
    if (systemPageBatchTimeoutMs! > 0) {
        const requests = 'parameters' in data ? data.parameters.requests : data.requests;
        requests.forEach((item) => {
            const parameters = 'parameters' in item ? item.parameters : item;
            parameters.timeout = systemPageBatchTimeoutMs;
        });
    }
    return ytApiV3Id.executeBatch(id, data);
};

async function loadMastersConfig(): Promise<[MastersConfigResponse, MasterAlert[]]> {
    const requests = [
        {
            command: 'get' as const,
            parameters: {
                path: '//sys/primary_masters',
                attributes: ['annotations', 'maintenance', 'maintenance_message'],
                ...USE_SUPRESS_SYNC,
            },
        },
        {
            command: 'get' as const,
            parameters: {
                path: '//sys/secondary_masters',
                attributes: ['annotations', 'maintenance', 'maintenance_message'],
                ...USE_SUPRESS_SYNC,
            },
        },
        {
            command: 'get' as const,
            parameters: {
                path: '//sys/timestamp_providers',
                attributes: ['annotations', 'maintenance', 'maintenance_message'],
                ...USE_SUPRESS_SYNC,
            },
        },
        {
            command: 'get' as const,
            parameters: {
                path: '//sys/discovery_servers',
                attributes: ['annotations', 'native_cell_tag'],
                ...USE_SUPRESS_SYNC,
            },
        },
        {
            command: 'get' as const,
            parameters: {
                path: '//sys/queue_agents/instances',
                attributes: ['annotations', 'maintenance', 'maintenance_message'],
                ...USE_SUPRESS_SYNC,
            },
        },
        {
            command: 'get' as const,
            parameters: {
                path: '//sys/@master_alerts',
                ...USE_SUPRESS_SYNC,
            },
        },
    ];

    const [
        primaryMasterResult,
        secondaryMastersResult,
        timestampProvidersResult,
        discoveryServersResult,
        queueAgentsResult,
        alertsResult,
    ] = await executeBatchWithTimeout(YTApiId.systemMastersConfig, {requests});

    const batchError = getBatchError(
        [primaryMasterResult, secondaryMastersResult],
        "Masters' details cannot be loaded",
    );

    if (batchError) {
        throw batchError;
    }

    const error = getBatchError([timestampProvidersResult], 'Timestamp providers cannot be loaded');

    if (error && timestampProvidersResult.error?.code !== NODE_DOES_NOT_EXIST) {
        throw error;
    }

    const queueAgentsError = getBatchError([queueAgentsResult], 'Queue agents cannot be loaded');

    if (queueAgentsError && queueAgentsResult.error?.code !== NODE_DOES_NOT_EXIST) {
        throw queueAgentsError;
    }

    const alerts = alertsResult.output ? (alertsResult.output as MasterAlert[]) : [];
    const [timestamp_path] = [...Object.keys(ypath.getValue(timestampProvidersResult.output))];
    const [primary_path] = [...Object.keys(ypath.getValue(primaryMasterResult.output))];

    const tag_cell_requests = [
        {
            command: 'get' as const,
            parameters: {
                path: `//sys/primary_masters/${primary_path}/orchid/config/primary_master/cell_id`,
                ...USE_SUPRESS_SYNC,
            },
        },
        {
            command: 'get' as const,
            parameters: {
                path: `//sys/timestamp_providers/${timestamp_path}/orchid/config/clock_cell`,
                ...USE_SUPRESS_SYNC,
            },
        },
    ];

    const [primaryMasterCellTag, timestampProviderCellTag] = await executeBatchWithTimeout(
        YTApiId.systemMastersConfig,
        {requests: [...tag_cell_requests]},
    );

    const primaryMaster = primaryMasterResult.output;
    const secondaryMasters = secondaryMastersResult.output;

    const timestampProviders = !timestampProvidersResult.output
        ? {}
        : {
              addresses: _.map(
                  ypath.getValue(timestampProvidersResult.output),
                  (value, address) => {
                      return {
                          host: address,
                          physicalHost: ypath.getValue(value, '/@annotations/physical_host'),
                          attributes: ypath.getValue(value, '/@'),
                      };
                  },
              ),
              cellId: ypath.getValue(timestampProviderCellTag.output)?.cell_id,
              cellTag: getCellIdTag(ypath.getValue(timestampProviderCellTag.output)?.cell_id),
          };

    const mainResult: MastersConfigResponse = {
        primaryMaster: {
            addresses: _.map(_.keys(primaryMaster), (address) => {
                const value = primaryMaster[address];

                return {
                    host: address,
                    physicalHost: ypath.getValue(value, '/@annotations/physical_host'),
                    attributes: ypath.getValue(value, '/@'),
                };
            }),
            cellId: primaryMasterCellTag.output,
            cellTag: getCellIdTag(primaryMasterCellTag.output),
        },
        secondaryMasters: _.map(secondaryMasters, (addresses, cellTag) => {
            return {
                addresses: _.map(_.keys(addresses), (address) => {
                    const value = secondaryMasters[cellTag][address];
                    return {
                        host: address,
                        physicalHost: ypath.getValue(value, '/@annotations/physical_host'),
                        attributes: ypath.getValue(value, '/@'),
                    };
                }),
                cellTag: Number(cellTag),
            };
        }),
        timestampProviders,
        discoveryServers: {},
        queueAgents: {},
    };

    const discoveryRequests = _.map(
        ypath.getValue(discoveryServersResult.output),
        (_v, address) => ({
            command: 'get' as const,
            parameters: {
                path: `//sys/discovery_servers/${address}/orchid/discovery_server`,
                ...USE_SUPRESS_SYNC,
            },
            address,
        }),
    );

    const queueAgentsStateRequests = _.map(
        ypath.getValue(queueAgentsResult.output),
        (_v, address) => ({
            command: 'get' as const,
            parameters: {
                path: `//sys/queue_agents/instances/${address}/orchid/cypress_synchronizer/active`,
                ...USE_SUPRESS_SYNC,
            },
            address,
        }),
    );

    let discoveryServersStatuses: Record<string, 'offline' | 'online'> = {};
    let queueAgentsStatuses: Record<string, any> = {};

    try {
        const results = await executeBatchWithTimeout(YTApiId.systemMastersConfigDiscoveryServer, {
            requests: [...discoveryRequests, ...queueAgentsStateRequests],
        });

        const discoveryResults = results.slice(0, discoveryRequests.length);
        const queueAgentsStateResults = results.slice(
            discoveryRequests.length,
            discoveryRequests.length + queueAgentsStateRequests.length,
        );

        discoveryServersStatuses = _.reduce(
            discoveryResults,
            (acc, item, key) => {
                acc[discoveryRequests[key].address] = item?.error ? 'offline' : 'online';
                return acc;
            },
            {} as {[address: string]: 'offline' | 'online'},
        );
        queueAgentsStatuses = _.reduce(
            queueAgentsStateResults,
            (acc, item, key) => {
                acc[queueAgentsStateRequests[key].address] =
                    typeof item.output !== 'undefined'
                        ? item.output
                            ? 'active'
                            : 'standby'
                        : 'offline';
                return acc;
            },
            {} as {[address: string]: string},
        );
    } catch {}

    mainResult.discoveryServers = discoveryServersResult.output
        ? {
              addresses: _.map(ypath.getValue(discoveryServersResult.output), (value, address) => {
                  return {
                      host: address,
                      physicalHost: ypath.getValue(value, '/@annotations/physical_host'),
                      attributes: ypath.getValue(value, '/@'),
                      state: discoveryServersStatuses[address],
                  };
              }),
              cellTag: ypath.getValue(discoveryServersResult.output, '/@native_cell_tag'),
          }
        : {};

    mainResult.queueAgents = queueAgentsResult.output
        ? {
              addresses: _.map(ypath.getValue(queueAgentsResult.output), (value, address) => {
                  return {
                      host: address,
                      physicalHost: ypath.getValue(value, '/@annotations/physical_host'),
                      attributes: ypath.getValue(value, '/@'),
                      state: queueAgentsStatuses[address],
                  };
              }),
          }
        : {};

    return [mainResult, alerts];
}

function loadHydra(
    requests: BatchSubRequest[],
    masterInfo: MasterDataItemInfo[],
    type: 'primary' | 'providers' | 'secondary',
    masterEntry: ResponseItemsGroup,
) {
    const {addresses, cellTag} = masterEntry;
    const hydraPath = '/orchid/monitoring/hydra';
    let cypressPath: string;

    if (type === 'primary') {
        cypressPath = '//sys/primary_masters';
    } else if (type === 'providers') {
        cypressPath = '//sys/timestamp_providers';
    } else if (type === 'secondary') {
        cypressPath = '//sys/secondary_masters/' + cellTag;
    } else {
        throw new Error('Unexpected type for loadHydra call');
    }

    _.each(
        _.sortBy(addresses, (address) => address.host),
        ({host}) => {
            masterInfo.push({host, type, cellTag: cellTag!});
            requests.push({
                command: 'get',
                parameters: {path: cypressPath + '/' + host + hydraPath, ...USE_SUPRESS_SYNC},
            });
        },
    );
}

export const getStateForHost = async (
    host: string,
): Promise<'leading' | 'following' | undefined> => {
    const cypressPath = '//sys/primary_masters';
    const hydraPath = '/orchid/monitoring/hydra';

    const masterDataRequests: BatchSubRequest[] = [
        {
            command: 'get' as const,
            parameters: {
                path: cypressPath + '/' + host + hydraPath,
                ...USE_SUPRESS_SYNC,
            },
        },
    ];

    const [result] = await executeBatchWithTimeout<{state: 'leading' | 'following'}>(
        YTApiId.systemMasters,
        {
            requests: masterDataRequests,
        },
    );

    return result.output?.state;
};

export function loadMasters() {
    return async (dispatch: Dispatch): Promise<void | {isRetryFutile: true}> => {
        dispatch({type: FETCH_MASTER_CONFIG.REQUEST});

        try {
            const [config, alerts] = await loadMastersConfig();

            dispatch({type: SET_MASTER_ALERTS, data: alerts});
            dispatch({type: FETCH_MASTER_CONFIG.SUCCESS, data: config});
            dispatch({type: FETCH_MASTER_DATA.REQUEST});

            const masterDataRequests: BatchSubRequest[] = [];
            const masterInfo: MasterDataItemInfo[] = [];

            loadHydra(masterDataRequests, masterInfo, 'primary', config.primaryMaster);

            _.each(config.secondaryMasters, (currentConfig) => {
                loadHydra(masterDataRequests, masterInfo, 'secondary', currentConfig);
            });

            loadHydra(masterDataRequests, masterInfo, 'providers', config.timestampProviders);

            const data = await executeBatchWithTimeout(YTApiId.systemMasters, {
                requests: masterDataRequests,
            });

            dispatch({type: FETCH_MASTER_DATA.SUCCESS, data: {masterInfo, data}});
        } catch (error) {
            dispatch({type: FETCH_MASTER_DATA.FAILURE, data: error});

            const data =
                (error as {response?: {data?: {code: string; message: string}}})?.response?.data ||
                (error as {code: string; message: string});

            const {code, message} = data;

            toaster.add({
                name: 'load/system/masters',
                autoHiding: false,
                type: 'error',
                content: `[code ${code}] ${message}`,
                title: 'Could not load Masters',
                actions: [{label: ' view', onClick: () => showErrorPopup(error as AxiosError)}],
            });

            if (isRetryFutile((error as {code: number})?.code)) {
                return {isRetryFutile: true};
            }
        }
    };
}

function getCellIdTag(uuid?: string): number | undefined {
    if (!uuid) {
        return undefined;
    }
    const [, , third = ''] = uuid.split('-');
    return Number(`0x${third.substring(0, third.length - 4)}`);
}
