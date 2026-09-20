import fs from 'fs';
let c = fs.readFileSync('src/gameplay/CampaignMode.js', 'utf8');
const newStages = `static STAGES = [
    { name: '渡桥遭遇', mapKey: 'bridge', objective: '全灭', enemyCount: 3, weather: 'clear', layout: '环形', events: null, difficulty: 1.0, weapons: ['sword'] },
    { name: '山口伏击', mapKey: 'pass', objective: '全灭', enemyCount: 4, weather: 'rain', layout: '伏击', events: null, difficulty: 1.15, weapons: ['sword'] },
    { name: '攻城战', mapKey: 'fortress', objective: '攻破城门', enemyCount: 5, weather: 'clear', layout: '方阵', events: null, difficulty: 1.3, weapons: ['sword', 'spear'] },
    { name: '风雪遭遇', mapKey: 'field', objective: '全灭', enemyCount: 6, weather: 'snow', layout: '线阵', events: { reinforce: 0.5 }, difficulty: 1.45, weapons: ['sword', 'spear'] },
    { name: '最终决战', mapKey: 'field', objective: 'Boss', enemyCount: 8, weather: 'storm', layout: '环形', events: { bossPhase: 0.5 }, difficulty: 1.6, weapons: ['sword', 'spear', 'warhammer'] },
    { name: '密林伏击', mapKey: 'forest', objective: '全灭', enemyCount: 7, weather: 'clear', layout: '伏击', events: { reinforce: 0.4 }, difficulty: 1.75, weapons: ['sword', 'spear'] },
    { name: '河谷护送', mapKey: 'river', objective: '护送', enemyCount: 6, weather: 'rain', layout: '线阵', events: { weatherShift: { at: 0.5, to: 'storm' } }, difficulty: 1.9, weapons: ['sword', 'spear'] },
    { name: '雪原生存', mapKey: 'snowfield', objective: '生存', enemyCount: 5, weather: 'snow', layout: '方阵', events: { reinforce: 0.3 }, difficulty: 2.05, weapons: ['sword', 'spear', 'warhammer'] },
    { name: '要塞防御', mapKey: 'keep', objective: '防御', enemyCount: 8, weather: 'clear', layout: '环形', events: { reinforce: 0.5 }, difficulty: 2.2, weapons: ['sword', 'spear', 'warhammer'] },
    { name: '终局之战', mapKey: 'keep', objective: 'Boss限时', enemyCount: 10, weather: 'storm', layout: '环形', events: { bossPhase: 0.5, reinforce: 0.3 }, difficulty: 2.4, weapons: ['sword', 'spear', 'warhammer'] },
  ];`;
c = c.replace(/static STAGES = \[[\s\S]*?\];/, newStages);
fs.writeFileSync('src/gameplay/CampaignMode.js', c);
console.log('STAGES 10 items:', (c.match(/name: '/g) || []).length);
