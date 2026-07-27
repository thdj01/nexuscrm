'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildInquiryPdf,
  buildInquiryPdfFileName,
} = require('../services/inquiryPdfService');

test('buildInquiryPdf creates a valid multipage PDF without null or undefined text', () => {
  const inquiry = {
    inquiryId: 'INQ-1025',
    inquiryDate: '2026-07-25T00:00:00.000Z',
    customerName: 'Example Customer',
    contacts: [{ name: 'Primary Contact', phone: '', email: null, designation: undefined }],
    projectName: 'Example Project',
    projectReference: { projectId: 'PRJ-204', projectName: 'Example Project' },
    panelTypes: ['VFD Panel'],
    inquiryType: 'VFD_PANEL',
    productType: 'VFD',
    applicationDescription: 'Long description for pagination testing. '.repeat(450),
    vfdDetails: {
      mainIncomer: { mainIncomerType: 'MCCB', supplyVoltage: '415 V AC 3 Phase' },
      loadDetails: [{ srNo: 1, loadDescription: 'Main Motor', qty: 1 }],
      additionalComponents: [
        {
          component: 'MCCB / MCB (Incomer)',
          required: 'No',
          preferredBrand: '',
          suggestedModelRange: '',
          remarks: '',
        },
        {
          component: 'Surge Protection Device (SPD)',
          required: 'Yes',
          preferredBrand: 'Phoenix Contact',
          suggestedModelRange: 'Type 2 SPD',
          remarks: 'Provide suitable backup protection.',
        },
      ],
    },
    status: 'NEW',
    reviewStatus: 'Pending',
    statusDetails: {
      inquiryHold: { reason: 'Internal workflow information must not be printed.' },
    },
    attachments: [{ name: 'specification.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }],
    bomAttachments: [],
    createdBy: { name: 'Test User' },
    createdAt: '2026-07-25T01:00:00.000Z',
    updatedAt: '2026-07-25T02:00:00.000Z',
  };

  const pdf = buildInquiryPdf(inquiry, { companyName: 'Nexus Automation' });
  const text = pdf.toString('latin1');

  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(pdf.length > 10_000);
  assert.ok((text.match(/\/Type \/Page\b/g) || []).length > 1);
  assert.equal(text.includes('(null)'), false);
  assert.equal(text.includes('(undefined)'), false);
  assert.equal(text.includes('(Additional Component 1)'), false);
  assert.equal(text.includes('(MCCB / MCB \\(Incomer\\))'), true);
  assert.equal(text.includes('(Status Details)'), false);
  assert.equal(text.includes('(Internal workflow information must not be printed.)'), false);
  assert.equal(text.includes('(Converted to Project)'), false);
});

test('buildInquiryPdfFileName follows the required project number fallback', () => {
  assert.equal(
    buildInquiryPdfFileName({ inquiryId: 'INQ-1025', projectReference: { projectId: 'PRJ-204' } }),
    'Inquiry-INQ-1025-PRJ-204.pdf'
  );
  assert.equal(
    buildInquiryPdfFileName({ inquiryId: 'INQ-1025' }),
    'Inquiry-INQ-1025.pdf'
  );
});


test('buildInquiryPdf safely ignores internal database objects from saved inquiries', () => {
  const fakeObjectId = {
    _bsontype: 'ObjectId',
    buffer: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    toHexString() { return '0102030405060708090a0b0c'; },
  };

  const inquiry = {
    inquiryId: 'INQ-REAL-1',
    inquiryDate: '2026-07-27T00:00:00.000Z',
    customerRef: {
      _id: fakeObjectId,
      customerId: 'CUS-10',
      customerName: 'Saved Customer',
      contacts: [{ name: 'Contact', phone: '9999999999' }],
    },
    liveCustomer: {
      _id: fakeObjectId,
      customerId: 'CUS-10',
      customerName: 'Saved Customer',
    },
    projectReference: {
      _id: fakeObjectId,
      projectId: 'PRJ-10',
      projectName: 'Saved Project',
    },
    statusDetails: {
      revision: {
        customerComment: 'Please revise the feeder rating.',
        updatedBy: fakeObjectId,
      },
    },
    kickoffMeeting: {
      scheduledBy: fakeObjectId,
      status: 'Scheduled',
    },
    panelTypes: ['MCC Panel'],
    mccDetails: {
      mainIncomer: { mainIncomerType: 'MCCB' },
    },
  };

  const pdf = buildInquiryPdf(inquiry);
  const text = pdf.toString('latin1');

  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(pdf.length < 500_000, `PDF unexpectedly large: ${pdf.length}`);
  assert.equal(text.includes('0102030405060708090a0b0c'), false);
});

test('buildInquiryPdf renders load detail arrays as tables instead of separate row sections', () => {
  const inquiry = {
    inquiryId: 'INQ-LOAD-TABLE',
    inquiryDate: '2026-07-27T00:00:00.000Z',
    projectReference: { projectId: 'PRJ-LOAD-1' },
    panelTypes: ['VFD Panel'],
    inquiryType: 'VFD_PANEL',
    loadDetails: [
      {
        description: 'Legacy Pump Motor',
        qty: 2,
        kw: 7.5,
        hp: 10.06,
        ampere: 13.04,
        startingMethod: 'DOL',
      },
    ],
    vfdDetails: {
      loadDetails: [
        {
          srNo: 1,
          loadDescription: 'Conveyor Motor',
          qty: 3,
          ratingKwHp: '5.5 kW / 7.38 HP',
          fullLoadCurrent: '9.56',
          remarks: 'Continuous duty',
        },
      ],
      softStarter: {
        loadDetails: [
          {
            srNo: 1,
            loadDescription: 'Mixer Motor',
            qty: 1,
            ratingKwHp: '11 kW / 14.75 HP',
            fullLoadCurrent: '19.12',
            remarks: '',
          },
        ],
      },
    },
  };

  const pdf = buildInquiryPdf(inquiry);
  const text = pdf.toString('latin1');

  assert.equal(text.includes('(Load Detail 1)'), false);
  assert.equal(text.includes('(Load Description)'), true);
  assert.equal(text.includes('(Total A)'), true);
  assert.equal(text.includes('(Remarks / Starting Method)'), true);
  assert.equal(text.includes('(Legacy Pump Motor)'), true);
  assert.equal(text.includes('(Starting Method: DOL)'), true);
  assert.equal(text.includes('(Conveyor Motor)'), true);
  assert.equal(text.includes('(Mixer Motor)'), true);
});
