
import dotenv from 'dotenv'
dotenv.config()
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID)
    try {
        await prisma.$connect()
        console.log('Successfully connected to the database')
    } catch (e) {
        console.error('Error connecting to database:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
