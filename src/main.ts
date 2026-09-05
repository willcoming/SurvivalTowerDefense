import './ui/styles.css';
import './ui/collection.css';
import './ui/mobile.css';
import './ui/mobile-secondary.css';
import './ui/mobile-combat.css';
import './ui/mobile-game.css';
import './ui/mobile-notice.css';
import { GameApp } from './ui/app';

const root = document.getElementById('app');
if (!root) throw new Error('找不到遊戲掛載點');
void new GameApp(root).init();
