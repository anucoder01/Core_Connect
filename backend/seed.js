const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // Clean up
  await prisma.pulseCheck.deleteMany();
  await prisma.task.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();

  // Create Employer (Admin)
  const employer = await prisma.user.create({
    data: {
      email: 'admin@company.com',
      password: 'adminpass', // In real app, hash this!
      name: 'Admin Boss',
      role: 'EMPLOYER',
      department: 'Management'
    }
  });

  // Create Employee
  const employee1 = await prisma.user.create({
    data: {
      email: 'john@company.com',
      password: 'pass123',
      name: 'John Doe',
      role: 'EMPLOYEE',
      department: 'Engineering',
      position: 'Senior Developer',
      salary: 120000
    }
  });

  // Create Leads
  await prisma.lead.create({
    data: {
      name: 'Acme Corp',
      company: 'Acme',
      email: 'contact@acme.com',
      status: 'NEW',
      value: 50000,
      assigneeId: employee1.id
    }
  });

  // Create Leaves
  await prisma.leaveRequest.create({
    data: {
      type: 'Annual',
      fromDate: new Date('2024-07-01'),
      toDate: new Date('2024-07-05'),
      reason: 'Vacation',
      status: 'APPROVED',
      userId: employee1.id
    }
  });

  // Create PulseCheck
  await prisma.pulseCheck.create({
    data: {
      score: 4,
      feedback: 'Things are going well, but I need a new monitor.',
      type: 'EMPLOYEE',
      userId: employee1.id
    }
  });

  console.log('Seeding complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
