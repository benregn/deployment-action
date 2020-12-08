import * as core from "@actions/core";
import * as github from "@actions/github";

type DeploymentState =
  | "error"
  | "failure"
  | "inactive"
  | "in_progress"
  | "queued"
  | "pending"
  | "success";

function isProductionEnvironment(
  productionEnvironmentInput: string
): boolean | undefined {
  if (["true", "false"].includes(productionEnvironmentInput)) {
    return productionEnvironmentInput === "true";
  }
  // Use undefined to signal, that the default behavior should be used.
  return undefined;
}

async function run() {
  try {
    const context = github.context;
    const defaultLogUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/commit/${context.sha}/checks`;

    const token = core.getInput("token", { required: true });
    const octokit = github.getOctokit(token, {
      previews: ["flash", "ant-man"],
    });

    const headRef = process.env.GITHUB_HEAD_REF as string;
    const ref =
      core.getInput("ref", { required: false }) || headRef || context.ref;
    const sha = core.getInput("sha", { required: false }) || context.sha;
    const logUrl =
      core.getInput("log_url", { required: false }) || defaultLogUrl;
    const environment =
      core.getInput("environment", { required: false }) || "production";
    const description = core.getInput("description", { required: false });
    const environmentUrl =
      core.getInput("environment_url", { required: false }) || "";
    const initialStatus =
      (core.getInput("initial_status", {
        required: false,
      }) as DeploymentState) || "pending";
    const autoMergeStringInput = core.getInput("auto_merge", {
      required: false,
    });
    const transientEnvironmentStringInput = core.getInput(
      "transient_environment",
      {
        required: false,
      }
    );
    const productionEnvironmentStringInput = core.getInput(
      "production_environment",
      {
        required: false,
      }
    );

    const auto_merge: boolean = autoMergeStringInput === "true";

    const transient_environment: boolean =
      transientEnvironmentStringInput === "true";

    const production_environment = isProductionEnvironment(
      productionEnvironmentStringInput
    );

    const deployment = await octokit.repos.createDeployment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: ref,
      sha: sha,
      required_contexts: [],
      environment,
      transient_environment,
      production_environment,
      auto_merge,
      description,
    });

    if (!("id" in deployment.data)) {
      // TODO: Should 202 be handled differently? Either way we get no ID
      throw new Error(deployment.data.message);
    }

    await octokit.repos.createDeploymentStatus({
      ...context.repo,
      deployment_id: deployment.data.id,
      description,
      state: initialStatus,
      log_url: logUrl,
      environment_url: environmentUrl
    });

    core.setOutput("deployment-id", deployment.data.id.toString());
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run();
