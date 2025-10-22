# VISSR <-> MongoDB Integration

A proof-of-concept application demonstrating real-time synchronization between the Vehicle Information Service Specification Reference Implementation (VISSR) and MongoDB. This interactive web application connects to a VISSR server to stream vehicle telemetry data using the Vehicle Signal Specification (VSS), stores it in MongoDB, and visualizes it in real-time with an intuitive interface.

## Architecture

![Architecture Diagram](public/architecture.svg)

The application uses a modern Next.js frontend that connects to a VISSR server via WebSocket. Vehicle data flows through MongoDB, where change streams enable real-time updates back to the client for synchronized status displays and map visualization.

## Prerequisites

Before you begin, ensure you have the following:

- **VISSR Server** - Install and run locally from [COVESA/vissr](https://github.com/COVESA/vissr/tree/master)
- **Zenseact Open Dataset** - Optional, for realistic vehicle data playback ([download options here](https://zod.zenseact.com/download/))
- **MongoDB Atlas** - A cluster (M0 free tier or higher)
- **Node.js** - Version 22 or higher

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
MONGODB_URI=your_mongodb_connection_string
DATABASE_NAME=vissr_db
```

### 3. Set Up MongoDB

To store and sync vehicle data with MongoDB, create a database trigger in MongoDB Atlas that runs the handler in [`utils/triggers/updateVehicleState.js`](utils/triggers/updateVehicleState.js) each time a new telemetry document is inserted. This trigger implements the real-time update logic for vehicle state and telemetry.

**Disclaimer:** This trigger-based approach is intended for demonstration purposes in small-scale/proof-of-concept environments. For production systems or when scaling to larger volumes of streaming data, consider using [MongoDB Atlas Stream Processing](https://www.mongodb.com/products/platform/atlas-stream-processing).

### 4. Generate Custom Trip Data (Optional)

If you have the Zenseact Open Dataset, you can generate custom VSS-compliant trip data for the VISSR feeder:

1. Navigate to `utils/notebooks/`
2. Open `zod-dataset.ipynb` in Jupyter
3. Follow the notebook to convert ZOD drive data into `tripdata.json`
4. Use the generated file with VISSR Feederv3

### 5. Start VISSR Feederv3 and Server

Follow the [VISSR installation guide](https://github.com/COVESA/vissr/tree/master) to start your local feeder and VISSR server on port 8080.

### 6. Run the Application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Connect and Explore

1. (Optional) Enter your VISSR server's IP address (by default it will connect to localhost)
2. Click **Connect** to establish the WebSocket connection
3. Use the Command Builder to send VSS commands and subscribe to vehicle signals
4. Watch real-time vehicle data appear in the status panel and on the map

## Resources

- [COVESA - Connected Vehicle Systems Alliance](https://covesa.global/)
- [VISSR on GitHub](https://github.com/COVESA/vissr)
- [Vehicle Signal Specification (VSS)](https://covesa.github.io/vehicle_signal_specification/)
- [Zenseact Open Dataset](https://zod.zenseact.com/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
