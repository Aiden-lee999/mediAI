const { spawn } = require('child_process');

console.log("터널을 생성 중입니다. 잠시만 기다려주세요...");

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const cf = spawn(npx, ['cloudflared', 'tunnel', '--url', 'http://127.0.0.1:3000'], { shell: true });

cf.stderr.on('data', (data) => {
    const output = data.toString();
    const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && match[0]) {
        console.log('\n======================================================');
        console.log('✅ 외부 접속용 주소가 성공적으로 생성되었습니다!');
        console.log(`👉 이 주소를 친구에게 공유하세요: ${match[0]}`);
        console.log('======================================================\n');
        console.log('(테스트가 끝날 때까지 이 창을 열어두세요. Ctrl+C를 누르면 종료됩니다.)');
    }
});

cf.on('close', () => {
    console.log("터널이 종료되었습니다.");
});
