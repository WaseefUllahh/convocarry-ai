import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'test@convocarry.ai' },
    update: {},
    create: {
      email: 'test@convocarry.ai',
      displayName: 'Test User',
      authProvider: 'supabase',
      authProviderId: 'test-auth-id-1234',
      subscription: {
        create: {
          plan: 'FREE'
        }
      }
    },
  });

  // Create sample Carry Card
  const card = await prisma.carryCard.create({
    data: {
      ownerId: user.id,
      title: 'Sample ChatGPT Research',
      description: 'A test carry card for testing UI',
      tags: ['research', 'test'],
      versions: {
        create: {
          platform: 'chatgpt',
          contextBody: [
            { role: 'user', text: 'Explain quantum computing' },
            { role: 'assistant', text: 'Quantum computing is a type of computing that uses quantum mechanics...' }
          ]
        }
      }
    },
    include: {
      versions: true
    }
  });

  // Set current version
  await prisma.carryCard.update({
    where: { id: card.id },
    data: { currentVersionId: card.versions[0].id }
  });

  console.log('Seeding complete. Created user:', user.email);
  console.log('Created Card:', card.title);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
