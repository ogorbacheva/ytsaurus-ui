import React from 'react';
import {useDispatch} from 'react-redux';

import {loadTabletErrorsByBundle} from '../../store/actions/tablet-errors/tablet-errors-by-bundle';

export function TabletErrors({bundle}: {bundle: string}) {
    const dispatch = useDispatch();
    React.useEffect(() => {
        dispatch(
            loadTabletErrorsByBundle({
                tablet_cell_bundle: bundle,
                start_timestamp: Date.now() - 3600 * 1000 * 24,
                end_timestamp: Date.now(),
            }),
        );
    }, [bundle, dispatch]);

    return <div>Not implemented</div>;
}
