#!

# Make sure node has everything it needs
echo "Running npm install to make sure Node.js is up-to-date..."
npm install

echo "Starting the Home Automation Controller..."
# Run the home automation controller
node homeAutomationController.js
