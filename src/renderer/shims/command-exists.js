const commandExists = async command => window.mt.fileSystem.commandExistsSync(command)

commandExists.sync = command => window.mt.fileSystem.commandExistsSync(command)

export default commandExists
