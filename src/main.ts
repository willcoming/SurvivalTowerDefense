import './ui/styles.css';
import { GameApp } from './ui/app';

const root = document.getElementById('app');
if (!root) throw new Error('找不到遊戲掛載點');
void new GameApp(root).init();
