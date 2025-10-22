exports = async function (changeEvent) {
  //Single vehicle for demo purposes
  const VIN = "MDBAX9C12XYZ1234";

  // Type mapping dictionary
  const signalTypeMap = {
    "Vehicle.Acceleration.Lateral": "double",
    "Vehicle.Acceleration.Longitudinal": "double",
    "Vehicle.AngularVelocity.Pitch": "double",
    "Vehicle.AngularVelocity.Roll": "double",
    "Vehicle.Body.Lights.DirectionIndicator.Left.IsSignaling": "bool",
    "Vehicle.Body.Lights.DirectionIndicator.Right.IsSignaling": "bool",
    "Vehicle.Chassis.Accelerator.PedalPosition": "int",
    "Vehicle.Chassis.Brake.PedalPosition": "int",
    "Vehicle.Chassis.SteeringWheel.Angle": "int",
    "Vehicle.CurrentLocation.Altitude": "double",
    "Vehicle.CurrentLocation.Heading": "double",
    "Vehicle.CurrentLocation.Latitude": "double",
    "Vehicle.CurrentLocation.Longitude": "double",
    "Vehicle.MotionManagement.Steering.SteeringWheel.Torque": "int",
    "Vehicle.Speed": "double",
  };

  // Function to convert string value to proper type
  function convertValue(stringValue, bsonType) {
    switch (bsonType) {
      case "double":
        return parseFloat(stringValue);
      case "int":
        return parseInt(stringValue);
      case "bool":
        return stringValue === "true" || stringValue === true;
      default:
        return stringValue;
    }
  }

  try {
    // Get the inserted document
    const insertedDoc = changeEvent.fullDocument;

    // Check if data array exists
    if (!insertedDoc.data || !Array.isArray(insertedDoc.data)) {
      console.log("No data array found in inserted document");
      return;
    }

    // Build the update object
    const updateFields = {};

    for (const item of insertedDoc.data) {
      const path = item.path;
      const stringValue = item.dp.value;

      // Get the BSON type for this signal
      const bsonType = signalTypeMap[path];

      if (bsonType) {
        // Convert the string value to the proper type
        const convertedValue = convertValue(stringValue, bsonType);

        // Use dot notation for nested document updates
        updateFields[path] = convertedValue;
      } else {
        console.log(`Unknown signal path: ${path}`);
      }
    }

    // If we have fields to update, perform the update
    if (Object.keys(updateFields).length > 0) {
      const serviceName = "IST-Shared";
      const databaseName = "vissr-integration"; // Replace with your database name
      const db = context.services.get(serviceName).db(databaseName);

      const vehicleStatusCollection = db.collection("vehicle_status");
      const telemetryCollection = db.collection("telemetry");

      // Update vehicle_status collection
      await vehicleStatusCollection.updateOne(
        { "Vehicle.VehicleIdentification.VIN": VIN },
        { $set: updateFields }
      );

      // Insert into telemetry collection
      const telemetryDoc = {
        ts: changeEvent.fullDocument.ts,
        vin: VIN,
        dp: updateFields,
      };

      await telemetryCollection.insertOne(telemetryDoc);
    } else {
      console.log("No valid fields to update");
    }
  } catch (err) {
    console.error("Error processing trigger: ", err.message);
  }
};
