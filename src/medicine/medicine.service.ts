import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Medicine, MedicineDocument } from './medicine.schema';

@Injectable()
export class MedicineService {
  private readonly logger = new Logger(MedicineService.name);

  constructor(
    @InjectModel(Medicine.name) private medicineModel: Model<MedicineDocument>,
  ) {}

  // NEW METHOD: Get total medicine count
  async getTotalCount(): Promise<number> {
    this.logger.log('Getting total medicine count');
    try {
      return await this.medicineModel.countDocuments().exec();
    } catch (error) {
      this.logger.error('Error counting medicines:', error);
      return 0;
    }
  }

  async searchMedicines(
    query: string,
    limit = 50,
    page = 1,
  ): Promise<{ items: Medicine[]; total: number; page: number; limit: number }> {
    this.logger.log(`Searching medicines with query: ${query} limit=${limit} page=${page}`);
    const filter: any = {};
    if (query && query.trim().length > 0) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { genericName: { $regex: query, $options: 'i' } },
      ];
    }

    const cappedLimit = Math.min(limit, 1000);
    const skip = (Math.max(page, 1) - 1) * cappedLimit;

    const [items, total] = await Promise.all([
      this.medicineModel.find(filter).skip(skip).limit(cappedLimit).exec(),
      this.medicineModel.countDocuments(filter).exec(),
    ]);

    return { items, total: total || 0, page: Math.max(page, 1), limit: cappedLimit };
  }

  async getMedicineById(id: string): Promise<Medicine> {
    this.logger.log(`Fetching medicine with ID: ${id}`);
    const medicine = await this.medicineModel.findById(id).exec();
    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }
    return medicine;
  }

  async getMedicineAlternatives(id: string): Promise<Medicine[]> {
    this.logger.log(`Fetching alternatives for medicine: ${id}`);
    const medicine = await this.medicineModel.findById(id).exec();
    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }

    if (medicine.alternatives && medicine.alternatives.length > 0) {
      return this.medicineModel
        .find({
          name: { $in: medicine.alternatives },
        })
        .exec();
    }

    // Find similar medicines based on purpose
    return this.medicineModel
      .find({
        purpose: medicine.purpose,
        _id: { $ne: medicine._id },
      })
      .limit(5)
      .exec();
  }

  async seedMedicines(): Promise<any> {
    this.logger.log('Seeding medicines');
    const medicines = [
      {
        name: 'Amoxicillin',
        genericName: 'Amoxicillin',
        strength: '500mg',
        purpose: 'Antibiotic for bacterial infections',
        sideEffects: ['Nausea', 'Diarrhea', 'Rash'],
        warnings: ['Take with food', 'Complete full course'],
        price: '$15.99',
        availability: 'In stock',
        alternatives: ['Penicillin VK', 'Cephalexin', 'Azithromycin'],
      },
      {
        name: 'Ibuprofen',
        genericName: 'Ibuprofen',
        strength: '400mg',
        purpose: 'Pain relief and anti-inflammatory',
        sideEffects: ['Stomach pain', 'Heartburn', 'Dizziness'],
        warnings: ['Take with food', 'Do not exceed recommended dose'],
        price: '$8.49',
        availability: 'In stock',
        alternatives: ['Acetaminophen', 'Naproxen', 'Aspirin'],
      },
      {
        name: 'Paracetamol',
        genericName: 'Acetaminophen',
        strength: '500mg',
        purpose: 'Pain and fever relief',
        sideEffects: ['Rare at recommended doses'],
        warnings: ['Do not exceed 4000mg per day', 'Avoid alcohol'],
        price: '$5.99',
        availability: 'In stock',
        alternatives: ['Ibuprofen', 'Aspirin'],
      },
      {
        name: 'Cetirizine',
        genericName: 'Cetirizine',
        strength: '10mg',
        purpose: 'Allergy relief',
        sideEffects: ['Drowsiness', 'Dry mouth', 'Headache'],
        warnings: ['May cause drowsiness'],
        price: '$12.99',
        availability: 'In stock',
        alternatives: ['Loratadine', 'Fexofenadine', 'Diphenhydramine'],
      },
      {
        name: 'Omeprazole',
        genericName: 'Omeprazole',
        strength: '20mg',
        purpose: 'Acid reflux and heartburn',
        sideEffects: ['Headache', 'Nausea', 'Diarrhea'],
        warnings: ['Take before meals'],
        price: '$18.99',
        availability: 'In stock',
        alternatives: ['Esomeprazole', 'Pantoprazole', 'Ranitidine'],
      },
      {
        name: 'Metformin',
        genericName: 'Metformin',
        strength: '500mg',
        purpose: 'Type 2 diabetes',
        sideEffects: ['Nausea', 'Diarrhea', 'Loss of appetite'],
        warnings: ['Take with food', 'Monitor blood sugar'],
        price: '$22.99',
        availability: 'In stock',
        alternatives: ['Glipizide', 'Sitagliptin', 'Pioglitazone'],
      },
      {
        name: 'Atorvastatin',
        genericName: 'Atorvastatin',
        strength: '20mg',
        purpose: 'High cholesterol',
        sideEffects: ['Muscle pain', 'Headache', 'Nausea'],
        warnings: ['Take at bedtime', 'Avoid grapefruit'],
        price: '$25.99',
        availability: 'In stock',
        alternatives: ['Simvastatin', 'Rosuvastatin', 'Pravastatin'],
      },
      {
        name: 'Levothyroxine',
        genericName: 'Levothyroxine',
        strength: '50mcg',
        purpose: 'Thyroid hormone replacement',
        sideEffects: ['Palpitations', 'Weight loss', 'Insomnia'],
        warnings: ['Take on empty stomach', 'Consistent timing'],
        price: '$14.99',
        availability: 'In stock',
        alternatives: ['Liothyronine', 'Natural thyroid'],
      },
      {
        name: 'Sertraline',
        genericName: 'Sertraline',
        strength: '50mg',
        purpose: 'Depression and anxiety',
        sideEffects: ['Nausea', 'Insomnia', 'Sexual dysfunction'],
        warnings: ['Take weeks to work', 'Do not stop suddenly'],
        price: '$28.99',
        availability: 'In stock',
        alternatives: ['Fluoxetine', 'Escitalopram', 'Paroxetine'],
      },
      {
        name: 'Amlodipine',
        genericName: 'Amlodipine',
        strength: '5mg',
        purpose: 'High blood pressure',
        sideEffects: ['Swelling', 'Headache', 'Flushing'],
        warnings: ['Take regularly', 'Monitor blood pressure'],
        price: '$16.99',
        availability: 'In stock',
        alternatives: ['Nifedipine', 'Diltiazem', 'Verapamil'],
      },
    ];

    // Clear existing medicines
    await this.medicineModel.deleteMany({});
    
    // Insert new medicines
    await this.medicineModel.insertMany(medicines);

    return {
      message: 'Medicines seeded successfully',
      count: medicines.length,
    };
  }
}