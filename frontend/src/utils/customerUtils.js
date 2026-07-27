export const resolveCustomerRecord = (record = {}) => {
  const customer = record?.customerRef || record?.customer || record?.liveCustomer || null;
  return customer && typeof customer === 'object' ? customer : null;
};

export const getLiveCustomerName = (record = {}) => {
  const customer = resolveCustomerRecord(record);
  return customer?.customerName || record.customerName || record.companyName || '';
};

export const getLiveContactPerson = (record = {}) => {
  const customer = resolveCustomerRecord(record);
  return customer?.contactPerson || record.contactPerson || '';
};

export const getLiveMobileNumber = (record = {}) => {
  const customer = resolveCustomerRecord(record);
  return customer?.mobileNumber || record.mobileNumber || record.contactNumber || '';
};

export const getLiveEmail = (record = {}) => {
  const customer = resolveCustomerRecord(record);
  return customer?.email || record.email || '';
};

export const getLiveCustomerId = (record = {}) => {
  const customer = resolveCustomerRecord(record);
  return customer?._id || customer?.id || record.customerRef || record.customer || '';
};


export const getLiveCompanyType = (record = {}) => {
  const customer = resolveCustomerRecord(record);
  return customer?.companyType || record.companyType || '';
};

export const getLiveContacts = (record = {}) => {
  const customer = resolveCustomerRecord(record);
  if (Array.isArray(customer?.contacts) && customer.contacts.length) return customer.contacts;
  if (Array.isArray(record.contacts) && record.contacts.length) return record.contacts;

  const contact = {
    name: getLiveContactPerson(record),
    phone: getLiveMobileNumber(record),
    email: getLiveEmail(record),
    designation: record.designation || '',
  };

  return contact.name || contact.phone || contact.email || contact.designation ? [contact] : [];
};
