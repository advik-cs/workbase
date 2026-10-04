import { getCommunityReconfirmationStats } from '../src/server/controllers/disasterController.ts';
import prisma from '../src/server/config/database.ts';

async function runTests() {
  console.log('Testing authorization for getCommunityReconfirmationStats...');

  // Mock Request and Response
  const createMockRes = () => {
    const res: any = {};
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data: any) => {
      res.data = data;
      return res;
    };
    return res;
  };

  // 1. Authorized Citizen (Related)
  // We need to create a test citizen, household, and disaster event with expected location
  const testUserId = 'test-citizen-userId';
  const testDisasterId = 'test-disasterId';
  
  // Clean up previous test runs if any
  await prisma.expectedLocation.deleteMany({ where: { disasterId: testDisasterId } });
  await prisma.householdMember.deleteMany({ where: { household: { userId: testUserId } } });
  await prisma.household.deleteMany({ where: { userId: testUserId } });
  await prisma.disasterEvent.deleteMany({ where: { id: testDisasterId } });

  const disaster = await prisma.disasterEvent.create({
    data: {
      id: testDisasterId,
      type: 'FLOOD',
      title: 'Test Disaster',
      alertLevel: 'RED',
      predictedStartTime: new Date(),
      predictedEndTime: new Date(),
      status: 'ACTIVE'
    }
  });

  const household = await prisma.household.create({
    data: {
      userId: testUserId,
      name: 'Test Household',
      latitude: 12,
      longitude: 77,
      phone: '1234567890',
      address: 'Test Address',
      zoneType: 'Test Zone'
    }
  });

  const member = await prisma.householdMember.create({
    data: {
      householdId: household.id,
      name: 'Test Member',
      category: 'ADULT'
    }
  });

  await prisma.expectedLocation.create({
    data: {
      disasterId: testDisasterId,
      householdMemberId: member.id,
      expectedType: 'HOME',
      reconfirmedStatus: 'SAME_PLAN'
    }
  });

  const req1: any = {
    params: { id: testDisasterId },
    user: { userId: testUserId, role: 'CITIZEN' }
  };
  const res1 = createMockRes();
  
  await getCommunityReconfirmationStats(req1, res1);
  if (res1.statusCode && res1.statusCode !== 200) {
    console.error(`[FAIL] Authorized Citizen rejected: ${res1.statusCode} - ${JSON.stringify(res1.data)}`);
    process.exit(1);
  }
  if (!res1.data || typeof res1.data.percentage !== 'number') {
    console.error(`[FAIL] Response missing aggregate stats: ${JSON.stringify(res1.data)}`);
    process.exit(1);
  }
  console.log('[PASS] Authorized Citizen successfully got aggregate stats');

  // 2. Unauthorized Citizen (Unrelated)
  const unrelatedDisasterId = 'unrelated-disasterId';
  await prisma.disasterEvent.create({
    data: {
      id: unrelatedDisasterId,
      type: 'CYCLONE',
      title: 'Unrelated Disaster',
      alertLevel: 'ORANGE',
      predictedStartTime: new Date(),
      predictedEndTime: new Date(),
      status: 'ACTIVE'
    }
  });

  const req2: any = {
    params: { id: unrelatedDisasterId },
    user: { userId: testUserId, role: 'CITIZEN' }
  };
  const res2 = createMockRes();

  await getCommunityReconfirmationStats(req2, res2);
  if (res2.statusCode !== 403) {
    console.error(`[FAIL] Unauthorized Citizen was not rejected (Got ${res2.statusCode || 200})`);
    process.exit(1);
  }
  console.log('[PASS] Unauthorized Citizen correctly rejected (403)');

  // 3. Authority (Always allowed)
  const req3: any = {
    params: { id: unrelatedDisasterId },
    user: { userId: 'some-authority-id', role: 'AUTHORITY' }
  };
  const res3 = createMockRes();
  
  await getCommunityReconfirmationStats(req3, res3);
  if (res3.statusCode && res3.statusCode !== 200) {
    console.error(`[FAIL] Authority was incorrectly rejected (Got ${res3.statusCode})`);
    process.exit(1);
  }
  console.log('[PASS] Authority always allowed');

  console.log('All authorization checks passed successfully.');
  process.exit(0);
}

runTests().catch(e => {
  console.error('[FATAL] Test failed:', e);
  process.exit(1);
});
