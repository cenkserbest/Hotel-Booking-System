const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Rooms:', await prisma.room.findMany());
  console.log('Hotels:', await prisma.hotel.findMany());
}
main().catch(console.error).finally(() => prisma.$disconnect());
