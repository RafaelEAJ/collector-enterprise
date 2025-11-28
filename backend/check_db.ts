
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        await prisma.$connect()
        console.log('Successfully connected to the database')
        const userCount = await prisma.user.count()
        console.log(`Found ${userCount} users`)
    } catch (e) {
        console.error('Error connecting to database:', e)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
