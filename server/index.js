const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/api/data', (req, res) => {
  const data = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
    // Add more data as needed
  ];
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});