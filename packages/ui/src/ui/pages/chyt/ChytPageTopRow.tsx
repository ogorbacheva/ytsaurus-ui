import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router';
import cn from 'bem-cn-lite';

import ypath from '../../common/thor/ypath';

import {Alert, Breadcrumbs, BreadcrumbsItem, Button} from '@gravity-ui/uikit';

import ClipboardButton from '../../components/ClipboardButton/ClipboardButton';
import {YTDFDialog, makeErrorFields} from '../../components/Dialog/Dialog';
import Favourites from '../../components/Favourites/Favourites';
import {EditableAsText} from '../../components/EditableAsText/EditableAsText';
import Link from '../../components/Link/Link';
import Suggest from '../../components/Suggest/Suggest';
import {Page} from '../../constants';
import {RowWithName} from '../../containers/AppNavigation/TopRowContent/SectionName';
import {PoolTreeLoaderWaitDeafultTree} from '../../hooks/global';
import {getFavouriteChyt, isActiveCliqueInFavourites} from '../../store/selectors/favourites';
import {getChytCurrrentClique} from '../../store/selectors/chyt';
import {getCluster, getGlobalDefaultPoolTreeName} from '../../store/selectors/global';
import {chytApiAction} from '../../store/actions/chyt/api';
import {chytCliqueCreate} from '../../store/actions/chyt/list';
import {chytToggleFavourite} from '../../store/actions/favourites';
import {useThunkDispatch} from '../../store/thunkDispatch';

import './ChytPageTopRow.scss';
import {YTError} from '../../../@types/types';

const block = cn('chyt-page-top-row');

export default function ChytPageTopRow() {
    return (
        <RowWithName page={Page.CHYT} name="CHYT cliques">
            <ChytFavourites />
            <ChytBreadcrumsbs />
            <CreateChytButton />
        </RowWithName>
    );
}

function ChytFavourites() {
    const isActiveInFavourites = useSelector(isActiveCliqueInFavourites);
    const favourites = useSelector(getFavouriteChyt);
    const dispatch = useDispatch();
    const currentClique = useSelector(getChytCurrrentClique);

    const handleFavouriteItemClick = React.useCallback(() => {
        // dispatch(setActiveAccount(item.path));
    }, [dispatch]);

    const handleFavouriteToggle = React.useCallback(() => {
        dispatch(chytToggleFavourite(currentClique));
    }, [dispatch, currentClique]);

    return (
        <Favourites
            isActive={isActiveInFavourites}
            items={favourites}
            onItemClick={handleFavouriteItemClick}
            onToggle={handleFavouriteToggle}
            toggleDisabled={!currentClique}
            theme={'clear'}
        />
    );
}

function ChytBreadcrumsbs() {
    const history = useHistory();
    const cluster = useSelector(getCluster);
    const alias = useSelector(getChytCurrrentClique);
    const items = React.useMemo(() => {
        const res: Array<BreadcrumbsItem & {url: string}> = [
            {
                text: '<Root>',
                url: `/${cluster}/${Page.CHYT}`,
                action: () => {},
            },
        ];
        if (alias) {
            res.push({text: alias, url: `/${cluster}/${Page.CHYT}/${alias}`, action: () => {}});
        }
        return res;
    }, [alias]);

    return (
        <div className={block('breadcrumbs')}>
            <EditableAsText
                className={block('editable')}
                onChange={(text) => {
                    if (!text) {
                        history.push(`/${cluster}/${Page.CHYT}`);
                    } else if (text !== alias) {
                        history.push(`/${cluster}/${Page.CHYT}/${text}`);
                    }
                }}
                text={alias}
                disableEdit={Boolean(!alias)}
                renderEditor={(props) => <ChytAliasSuggest cluster={cluster} {...props} />}
            >
                <Breadcrumbs
                    items={items}
                    lastDisplayedItemsCount={2}
                    firstDisplayedItemsCount={1}
                    renderItemContent={(item, isCurrent) => {
                        return (
                            <Link url={item.url} theme={isCurrent ? 'primary' : 'secondary'} routed>
                                {item.text}
                            </Link>
                        );
                    }}
                />
            </EditableAsText>
            {alias && <ClipboardButton text={alias} />}
        </div>
    );
}

function ChytAliasSuggest({
    value,
    onChange,
    className,
    onApply,
    cluster,
    onBlur,
}: {
    cluster: string;
    value?: string;
    onChange: (value?: string) => void;
    className?: string;
    onBlur: () => void;
    onApply: (value?: string) => void;
}) {
    const [items, setItems] = React.useState<Array<string>>([]);

    React.useEffect(() => {
        chytApiAction('list', cluster, {}).then((data) => {
            setItems(data.result.map((item) => ypath.getValue(item)));
        });
    }, []);

    return (
        <Suggest
            autoFocus
            className={`${block('alias-suggest')} ${className}`}
            text={value}
            filter={(_x, text) => {
                if (!text) {
                    return items;
                }
                return items.filter((item) => {
                    return -1 !== item.indexOf(text);
                });
            }}
            apply={(item) => {
                if ('string' === typeof item) {
                    onChange(item);
                } else {
                    onChange(item.value);
                }
            }}
            onItemClick={(item) => {
                onApply(typeof item === 'string' ? item : item.value);
            }}
            onBlur={onBlur}
        />
    );
}

type FormValues = {
    alias: string;
    instance_count: {value: number};
    tree: string;
    pool: string;
    runAfterCreation: boolean;
};

function CreateChytButton() {
    const dispatch = useThunkDispatch();
    const [visible, setVisible] = React.useState(false);
    const defaultPoolTree = useSelector(getGlobalDefaultPoolTreeName);

    const [error, setError] = React.useState<YTError | undefined>();

    return (
        <div className={block('create-clique')}>
            <Button view="action" onClick={() => setVisible(!visible)}>
                Create clique
            </Button>
            {visible && (
                <PoolTreeLoaderWaitDeafultTree>
                    <YTDFDialog<FormValues>
                        visible
                        headerProps={{title: 'Create clique'}}
                        onClose={() => setVisible(false)}
                        onAdd={(form) => {
                            const {
                                values: {instance_count, ...rest},
                            } = form.getState();
                            return dispatch(
                                chytCliqueCreate({
                                    ...rest,
                                    instance_count: instance_count.value,
                                }),
                            )
                                .then(() => {
                                    setError(undefined);
                                })
                                .catch((e) => {
                                    setError(e);
                                    return Promise.reject(e);
                                });
                        }}
                        fields={[
                            {
                                name: 'alert',
                                type: 'block',
                                extras: {
                                    children: (
                                        <Alert
                                            message={
                                                "The vast majority of ClickHouse's functionality is available in CHYT. " +
                                                'You can get acquainted with the capabilities of ClickHouse in the official documentation.'
                                            }
                                        />
                                    ),
                                },
                            },
                            {
                                name: 'alias',
                                type: 'text',
                                caption: 'Alias name',
                                required: true,
                            },
                            {
                                name: 'instance_count',
                                type: 'number',
                                caption: 'Instance count',
                                extras: {
                                    min: 1,
                                    max: 100,
                                    hidePrettyValue: true,
                                    showHint: true,
                                },
                                required: true,
                            },
                            {
                                name: 'tree',
                                type: 'pool-tree',
                                caption: 'Pool tree',
                                extras: {
                                    disabled: true,
                                },
                            },
                            {
                                name: 'pool',
                                type: 'pool',
                                caption: 'Pool',
                                extras: ({tree}: FormValues) => {
                                    return {poolTree: tree, placeholder: 'Pool name...'};
                                },
                                required: true,
                            },
                            {
                                name: 'runAfterCreation',
                                type: 'tumbler',
                                caption: 'Run after creation',
                            },
                            ...makeErrorFields([error]),
                        ]}
                        initialValues={{
                            instance_count: {value: 1},
                            tree: defaultPoolTree,
                            runAfterCreation: true,
                        }}
                    />
                </PoolTreeLoaderWaitDeafultTree>
            )}
        </div>
    );
}