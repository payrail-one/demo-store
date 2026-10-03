import { mount } from 'workstar';
import { createStore } from './store';
import './styles/base.css';
import './styles/store.css';
import './styles/products.css';
import './styles/cart.css';
import './styles/checkout.css';

const host = document.querySelector('#app');
if (!host) throw new Error('Missing application mount point.');

mount(host, createStore());
