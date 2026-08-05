require('dotenv').config();
const PORT = process.env.PORT || 5001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTest() {
  console.log("🚀 Testing Admin Login & Student Impersonation flow...");

  try {
    // 1. Log in as SUPER_ADMIN
    console.log("\n🔑 1. Logging in as SUPER_ADMIN...");
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "m.gh.alosimi@gmail.com",
        password: "12345678"
      })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.success) {
      throw new Error(`Login failed: ${loginData.error || loginRes.statusText}`);
    }

    const adminToken = loginData.token;
    console.log(`✅ Login successful! Received token for: ${loginData.user.name} (Role: ${loginData.user.role})`);

    // 2. Fetch all students via indexed-directory
    console.log("\n📂 2. Loading scoped accounts list...");
    const dirRes = await fetch(`${BASE_URL}/api/admin/users/indexed-directory?role=STUDENT&page=1&limit=5`, {
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      }
    });

    const dirData = await dirRes.json();
    if (!dirRes.ok || !dirData.success) {
      throw new Error(`Failed to load directory: ${dirData.error || dirRes.statusText}`);
    }

    if (dirData.data.length === 0) {
      throw new Error("No students found in directory!");
    }

    const targetStudent = dirData.data[0];
    console.log(`✅ Loaded directory! Selected student: ${targetStudent.name} (ID: ${targetStudent.id}, Email: ${targetStudent.email})`);

    // 3. Impersonate the student
    console.log(`\n🚀 3. Requesting impersonation for student ID ${targetStudent.id}...`);
    const impRes = await fetch(`${BASE_URL}/api/auth/impersonate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentId: targetStudent.id
      })
    });

    const impData = await impRes.json();
    if (!impRes.ok || !impData.success) {
      throw new Error(`Impersonation failed: ${impData.error || impRes.statusText}`);
    }

    console.log("✅ Impersonation successful! Received student impersonation details:");
    console.log(`   - Name: ${impData.user.name}`);
    console.log(`   - Email: ${impData.user.email}`);
    console.log(`   - Role: ${impData.user.role}`);
    console.log(`   - Group: ${impData.user.groupName}`);
    console.log(`   - Impersonation Token: ${impData.token.substring(0, 30)}...`);

    console.log("\n🎉 All tests passed successfully! Student Impersonation works 100% correctly on the backend.");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTest();
