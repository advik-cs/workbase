import { getWaterLevel } from '../src/server/controllers/disasterController.ts';
import prisma from '../src/server/config/database.ts';

async function run() {
  const createMockRes = (onData: (d: any) => void) => {
    const res: any = {};
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (data: any) => {
      onData(data);
      return res;
    };
    return res;
  };

  const user = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
  const disaster = await prisma.disasterEvent.findFirst();
  
  if (!user || !disaster) throw new Error('DB not seeded');

  let data: any;
  const req = {
    params: { id: disaster.id },
    user: { userId: user.id }
  };

  await getWaterLevel(req as any, createMockRes(d => data = d));
  console.log('Water Level API Response:', data);

  if (data.available !== false || data.reason !== 'NO_RELEVANT_GAUGE') {
    throw new Error('Unexpected water level API response');
  }
}

run().then(() => {
  console.log('Water Level API returned correct unavailable state.');
  process.exit(0);
}).catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
