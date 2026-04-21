import requests

# Call the dev endpoint to register student 485
url = "http://localhost:8000/dev/register-student-to-tournament/485"
response = requests.post(url)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")

# Now verify the tournament_participants records were created
import subprocess
result = subprocess.run([
    "docker", "compose", "exec", "postgres", "psql", "-U", "vovinam", "-d", "vovinam_db",
    "-c", "SELECT weight_class_id, student_id FROM tournament_participants WHERE student_id = 485;"
], capture_output=True, text=True)

print("\nTournament Participants for student 485:")
print(result.stdout)
