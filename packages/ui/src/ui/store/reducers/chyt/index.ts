import {combineReducers} from 'redux';

import list from './list';
import listFilters from './list-filters';
import clique from './clique';
import speclet from './speclet';

export const chyt = combineReducers({list, listFilters, clique, speclet});