import { registerRootComponent } from 'expo';
import App from './App';
import { registerWidget } from './src/services/widget';

// Android's home-screen widget renders in the background, before any screen opens.
registerWidget();
registerRootComponent(App);
