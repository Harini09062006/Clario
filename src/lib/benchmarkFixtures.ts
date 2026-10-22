import type { ClarioDocument } from '../types';

export const BENCHMARK_FIXTURES: ClarioDocument[] = [
  {
    id: 'bench-cmchis-2026',
    filename: 'TamilNadu_CM_Health_Insurance_Scheme_2026.pdf',
    title: 'Tamil Nadu CM Health Insurance Scheme 2026',
    language: 'Tamil',
    pageCount: 2,
    processingStatus: 'completed',
    summary: 'Official Tamil Nadu Government CMCHIS 2026 circular outlining family income criteria (ரூ. 1,20,000), Rs. 5,00,000 coverage, and March 31, 2026 deadline.',
    isSample: true,
    createdAt: '2026-01-15T09:00:00.000Z',
    pages: [
      {
        id: 'p-1-cmchis',
        pageNumber: 1,
        extractedText: `தமிழ்நாடு அரசு - மக்கள் நல்வாழ்வு மற்றும் குடும்ப நலத்துறை
முதலமைச்சரின் விரிவான மருத்துவக் காப்பீட்டுத் திட்டம் (CMCHIS) 2026 - அரசாணை எண் 42
முக்கிய தகுதி வரம்புகள் மற்றும் பயன்கள்:
1. இத்திட்டத்தின் கீழ் பயன்பெற குடும்பத்தின் அதிகபட்ச ஆண்டு வருமான வரம்பு ரூ. 1,20,000/- (ஒரு லட்சத்து இருபதாயிரம் ரூபாய்) என நிர்ணயிக்கப்பட்டுள்ளது. கிராம நிர்வாக அலுவலர் (VAO) மற்றும் வருவாய்த் துறையினரால் வழங்கப்பட்ட வருமானச் சான்றிதழ் கட்டாயமாகும்.
2. அங்கீகரிக்கப்பட்ட அரசு மற்றும் தனியார் மருத்துவமனைகளில் ஒரு குடும்பத்திற்கு ஆண்டிற்கு ரூ. 5,00,000/- (ரூபாய் ஐந்து லட்சம் மட்டும்) வரை கட்டணமில்லா மருத்துவ சிகிச்சை வழங்கப்படுகிறது.
3. முதலமைச்சர் மருத்துவக் காப்பீட்டு அட்டை (Smart Card) உள்ள அனைத்து குடும்ப உறுப்பினர்களும் இத்திட்டத்திற்கு தகுதியுடையவர்கள்.`,
        ocrConfidence: 0.98,
      },
      {
        id: 'p-2-cmchis',
        pageNumber: 2,
        extractedText: `விண்ணப்பிக்கும் நடைமுறை மற்றும் காலக்கெடு:
1. புதிய காப்பீட்டு அட்டை பெற அல்லது புதுப்பிக்க தகுதியுள்ள நபர்கள் உரிய ஆவணங்களுடன் மாவட்ட ஆட்சியர் அலுவலகத்தில் உள்ள முதலமைச்சர் மருத்துவக் காப்பீட்டு மையத்தில் விண்ணப்பிக்கலாம்.
2. இத்திட்டத்திற்கான விண்ணப்பங்களை சமர்ப்பிக்க கடைசி தேதி 31 மார்ச் 2026 (31 March 2026) ஆகும்.
3. ஆதார் அட்டை, குடும்ப அட்டை (Ration Card), மற்றும் வருமானச் சான்றிதழ் இணைக்கப்பட வேண்டும்.
4. உதவி மையம் மற்றும் குறைதீர்க்கும் எண்: 1800-425-3993`,
        ocrConfidence: 0.97,
      },
    ],
  },
  {
    id: 'bench-solar-2026',
    filename: 'UP_Krishi_Solar_Subsidy_Scanned_Table_2026.pdf',
    title: 'UP Krishi Solar Subsidy Scanned Table 2026',
    language: 'Hindi',
    pageCount: 2,
    processingStatus: 'completed',
    summary: 'Uttar Pradesh Agriculture Department solar pump subsidy circular with Table 1.1 pricing matrix for 2 HP and 3 HP pumps.',
    isSample: true,
    createdAt: '2026-02-10T11:30:00.000Z',
    pages: [
      {
        id: 'p-1-solar',
        pageNumber: 1,
        extractedText: `कृषि विभाग, उत्तर प्रदेश शासन
प्रधानमंत्री किसान ऊर्जा सुरक्षा एवं उत्थान महाभियान (PM-KUSUM)
योजना विवरण एवं दिशानिर्देश - वर्ष 2026
प्रदेश के लघु एवं सीमान्त कृषकों को सिंचाई हेतु रियायती दरों पर सोलर पम्प उपलब्ध कराने की योजना।
पात्रता शर्तें:
1. आवेदक उत्तर प्रदेश का मूल निवासी कृषक होना चाहिए।
2. कृषक के पास स्वयं की कृषि भूमि एवं उपयुक्त जल स्रोत (बोरवेल) उपलब्ध होना अनिवार्य है।
3. ऑनलाइन पंजीकरण कृषि विभाग के आधिकारिक पोर्टल upagriculture.com पर अनिवार्य है।`,
        ocrConfidence: 0.95,
      },
      {
        id: 'p-2-solar',
        pageNumber: 2,
        extractedText: `तालिका 1.1: सौर ऊर्जा पम्प मूल्य एवं अनुदान विवरण (Table 1.1 Pricing Matrix)
[स्कैन प्रतिलिपि / Scanned Document Extract]

मद संख्या | पम्प क्षमता एवं प्रकार | अनुमानित कुल लागत (₹) | 60% सरकारी अनुदान राशि (₹) | कृषक अंशदान 40% (₹)
1. | 2 HP DC Surface/Submersible Pump | ₹ 1,48,000 | ₹ 88,800 | ₹ 59,200
2. | 3 HP DC Submersible Solar Pump | ₹ 2,15,000 | ₹ 1,29,000 | ₹ 86,000
3. | 5 HP AC Submersible Solar Pump | ₹ 2,85,000 | ₹ 1,71,000 | ₹ 1,14,000

नोट: 2 HP DC सोलर पम्प की अनुमानित कुल लागत ₹1,48,000 है जिसमें 60% अनुदान राशि ₹88,800 राज्य एवं केन्द्र सरकार द्वारा वहन की जाएगी। कृषक को मात्र ₹59,200 जमा करने होंगे।
अंतिम टोकन जनरेशन एवं पंजीकरण तिथि: 30 अप्रैल 2026`,
        ocrConfidence: 0.92,
      },
    ],
  },
  {
    id: 'bench-scholarship-2026',
    filename: 'National_Merit_Scholarship_Notification_2026.pdf',
    title: 'National Merit Scholarship Notification 2026',
    language: 'English',
    pageCount: 2,
    processingStatus: 'completed',
    summary: 'Ministry of Education National Merit Scholarship Scheme notification covering undergraduate and postgraduate courses only.',
    isSample: true,
    createdAt: '2026-03-01T14:00:00.000Z',
    pages: [
      {
        id: 'p-1-scholarship',
        pageNumber: 1,
        extractedText: `Government of India - Ministry of Education
National Merit Scholarship Scheme 2026-2027
Official Guidelines and Eligibility Criteria:
1. Target Beneficiaries: Students pursuing full-time regular undergraduate (UG) and postgraduate (PG) degree courses in recognized colleges and universities.
2. Minimum Academic Requirement: Minimum 60% aggregate marks in Class 12th Board Examination or equivalent qualifying degree.
3. Family Income Ceiling: Total annual family income from all sources must not exceed Rs. 2,50,000/- per annum.
4. Renewal Criteria: Minimum 55% marks in each annual examination and 75% attendance.`,
        ocrConfidence: 0.98,
      },
      {
        id: 'p-2-scholarship',
        pageNumber: 2,
        extractedText: `Scholarship Disbursement Rates and Registration Timeline:
1. Undergraduate (UG) Students: Rs. 12,000 per annum for 3 or 4 years duration.
2. Postgraduate (PG) Students: Rs. 20,000 per annum for 2 years duration.
3. Disbursement: Direct Benefit Transfer (DBT) directly into Aadhaar-seeded bank account.
4. Official Portal Deadline: Applications must be submitted through the National Scholarship Portal (scholarships.gov.in) on or before October 31, 2026.
Note: This scheme strictly covers undergraduate and postgraduate degree courses. Doctoral, PhD, Post-Doctoral fellowships, and distance learning programs are outside the scope of this notification.`,
        ocrConfidence: 0.98,
      },
    ],
  },
];
