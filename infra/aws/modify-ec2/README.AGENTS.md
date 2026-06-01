# modify-ec2

- Purpose: Run scripts to modify the existing EC2
- All modifications should also be added to the `bootstrap-ec2` or `setup-ec2` scripts. For example, add-cloudwatch.sh retroactively assigns the EC2 instance role permissions and starts a CloudWatch service. `infra/aws/setup-ec2/setup-instance-profile.sh` and `infra/aws/bootstrap-ec2/setup-cloudwatch-logs.sh` were modified to add the new permissions and service, respectively for the next EC2 instance creation
