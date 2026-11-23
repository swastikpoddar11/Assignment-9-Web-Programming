# Enterprise XML Employee Directory

A lightweight, zero-dependency client-side web application that ingests employee records from XML files and renders them into an interactive tabular dashboard.

## Key Features

- **Safe In-Memory XML Ingestion**: Parses XML documents using standard browser `DOMParser` with built-in syntax error boundaries.
- **Dual Data Loading Modes**:
  - Direct HTTP fetch of default bundled datasets (`employees.xml`).
  - File picker using HTML5 `FileReader` for local files without CORS restrictions.
- **Bi-Directional Column Sorting**: Sort records by ID, name, department, role, salary, joining date, or status.
- **Multi-Filter & Full-Text Search**: Live filtering across text inputs, department dropdowns, and employment status.
- **Dynamic KPI Dashboard**: Real-time aggregated metrics for total headcount, active employees, department count, and average compensation.
- **Pagination & Export**: Configurable pagination controls and one-click RFC 4180-compliant CSV export.
- **XSS Resistant**: Escapes untrusted XML string content prior to DOM insertion.

## Project Structure

```text
.
├── .gitignore         # Version control exclusion rules
├── app.js             # XML parsing, sorting, filtering, and rendering logic
├── employees.xml      # Sample XML dataset containing employee entities
├── index.html         # Application markup and accessible data tables
├── README.md          # Project documentation and developer guide
└── styles.css         # Modern responsive styling and design system
```

## Supported XML Data Schema

The application expects an XML structure containing `<employee>` nodes within a root entity:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<company>
  <employees>
    <employee id="EMP-1001">
      <name>Sarah Jenkins</name>
      <department>Engineering</department>
      <role>Lead Systems Architect</role>
      <email>s.jenkins@enterprise.io</email>
      <salary currency="USD">145000</salary>
      <joiningDate>2021-03-15</joiningDate>
      <status>Active</status>
    </employee>
  </employees>
</company>
```

## Getting Started

### Option 1: Using Python Built-in HTTP Server
```bash
python -m http.server 8000
```
Open [http://localhost:8000/index.html](http://localhost:8000/index.html) in your browser.

### Option 2: Using Node.js `npx serve`
```bash
npx serve .
```

### Option 3: Direct File Opening
Double-click `index.html` to open in any web browser. Use the **Upload XML File** button to select `employees.xml` from your local disk.

## Browser Support
- Google Chrome (latest)
- Mozilla Firefox (latest)
- Microsoft Edge (latest)
- Apple Safari (latest)
