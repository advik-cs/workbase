import { getReconfirmationStatus, getCommunityReconfirmationStats, submitReconfirmation } from '../src/server/controllers/disasterController.ts';
import prisma from '../src/server/config/database.ts';

async function run() {
  const createMockRes = (onData: (d: any) => void) => {
    const res: any = {};
    res.status = (c: number) => res;
    res.json = (data: any) => {
      onData(data);
      return res;
    };
    return res;
  };

  // Get active disaster and user
  const user = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
  const disaster = await prisma.disasterEvent.findFirst();
  if (!user || !disaster) throw new Error('DB not seeded');

  let reconfData: any = {};
  let statsData: any = {};

  const reqGet = {
    params: { id: disaster.id },
    user: { userId: user.id, role: user.role }
  };

  await getReconfirmationStatus(reqGet as any, createMockRes(d => reconfData = d));
  await getCommunityReconfirmationStats(reqGet as any, createMockRes(d => statsData = d));

  const verifiedBefore = (reconfData.summary?.confirmedSame || 0) + (reconfData.summary?.changed || 0) + (reconfData.summary?.uncertain || 0);
  const totalBefore = reconfData.summary?.totalAffectedMembers || 0;
  console.log(`BEFORE: Reconfirmation Page = ${verifiedBefore} of ${totalBefore} Verified`);
  console.log(`BEFORE: Zone Sensor Card = ${statsData.percentage}% Verified (Expected: ${totalBefore > 0 ? (verifiedBefore/totalBefore)*100 : 0}%)`);

  if (statsData.percentage !== (totalBefore > 0 ? (verifiedBefore/totalBefore)*100 : 0)) {
    throw new Error('Inconsistent before state');
  }

  // Find household members
  const hh = await prisma.household.findFirst({ where: { userId: user.id }, include: { members: true } });
  if (!hh) throw new Error('No hh');
  
  // Submit new reconfirmation
  const items = hh.members.map((m, i) => ({
    householdMemberId: m.id,
    action: i % 2 === 0 ? 'SAME_PLAN' : 'NOT_SURE'
  }));

  const reqPost = {
    params: { id: disaster.id },
    user: { userId: user.id, role: user.role },
    body: {
      choice: 'SAME_PLAN',
      reconfirmations: items
    }
  };

  let postRes: any;
  await submitReconfirmation(reqPost as any, createMockRes(d => postRes = d));
  console.log('Submission result:', postRes);

  await getReconfirmationStatus(reqGet as any, createMockRes(d => reconfData = d));
  await getCommunityReconfirmationStats(reqGet as any, createMockRes(d => statsData = d));

  const verifiedAfter = (reconfData.summary?.confirmedSame || 0) + (reconfData.summary?.changed || 0) + (reconfData.summary?.uncertain || 0);
  const totalAfter = reconfData.summary?.totalAffectedMembers || 0;
  console.log(`AFTER: Reconfirmation Page = ${verifiedAfter} of ${totalAfter} Verified`);
  console.log(`AFTER: Zone Sensor Card = ${statsData.percentage}% Verified`);

  if (statsData.percentage !== (totalAfter > 0 ? (verifiedAfter/totalAfter)*100 : 0)) {
    throw new Error('Inconsistent after state');
  }
}

run().then(() => {
  console.log('All tests passed consistently!');
  process.exit(0);
}).catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
